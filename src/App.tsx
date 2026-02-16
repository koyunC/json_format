import React, { useState, useEffect } from 'react';
import { DataList, type DataRecord } from './components/DataList';
import { Upload, Download, RefreshCw, Play, FileJson, AlertCircle } from 'lucide-react';
import axios from 'axios';

// Utility to flatten nested JSON
const flattenObject = (obj: any, prefix = ''): any => {
  return Object.keys(obj).reduce((acc: any, k) => {
    const pre = prefix.length ? prefix + '.' : '';
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flattenObject(obj[k], pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
};

function App() {
  const [data, setData] = useState<DataRecord[]>([]);
  const [filteredData, setFilteredData] = useState<DataRecord[]>([]);
  const [allKeys, setAllKeys] = useState<string[]>([]);
  const [keyDensity, setKeyDensity] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [rawInput, setRawInput] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'ingest'>('ingest');
  const [filterStatus] = useState<string>('');

  // Filter data when search term or data changes
  useEffect(() => {
    if (!searchTerm) {
      setFilteredData(data);
    } else {
      const lower = searchTerm.toLowerCase();
      setFilteredData(data.filter(d =>
        Object.values(d).some(v => String(v).toLowerCase().includes(lower))
      ));
    }
  }, [data, searchTerm]); // Removed filterStatus from dependencies as it's not used here

  const fetchData = async () => { // Moved fetchData into App scope
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(window.location.search);
      const limit = params.get('limit') || 100;
      const status = filterStatus || params.get('status') || '';

      const response = await axios.get(`/api/data?limit=${limit}&status=${status}`);
      if (response.data && Array.isArray(response.data.data)) {
        setData(response.data.data);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to fetch data from backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterStatus]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        processIngestedData(json);
      } catch (err) {
        setError("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const handlePasteIngest = () => {
    try {
      const json = JSON.parse(rawInput);
      processIngestedData(json);
      setRawInput('');
    } catch (err) {
      setError("Invalid JSON text.");
    }
  };

  const processIngestedData = (json: any) => {
    let dataToSet: any[] = [];

    if (Array.isArray(json)) {
      dataToSet = json;
    } else if (typeof json === 'object' && json !== null) {
      // Try to find an array in common property names
      const candidates = ['task_results', 'data', 'items', 'results', 'records'];
      for (const key of candidates) {
        if (Array.isArray(json[key])) {
          dataToSet = json[key];
          break;
        }
      }

      // If still no array, and it looks like a single record, wrap it
      if (dataToSet.length === 0 && Object.keys(json).length > 0) {
        // Fallback: treat the object itself as one record if it has 'id' or typical fields, 
        // otherwise we might just be looking at metadata. 
        // But the user said "data.json" which has "task_results".
        // Let's also check if *any* value is an array
        if (dataToSet.length === 0) {
          const arrayValue = Object.values(json).find(v => Array.isArray(v));
          if (arrayValue) {
            dataToSet = arrayValue as any[];
          }
        }
      }
    }

    if (dataToSet.length > 0) {
      // Normalize IDs if missing and flatten data
      const processed = dataToSet.map((item, idx) => {
        const flat = flattenObject(item);
        return {
          ...flat,
          id: item.id || flat.id || `gen-${idx}-${Date.now()}`
        };
      });

      setData(processed);

      // Collect all unique keys and calculate density
      const density: Record<string, number> = {};
      processed.forEach(item => {
        Object.keys(item).forEach(k => {
          density[k] = (density[k] || 0) + 1;
        });
      });

      const keys = Array.from(new Set(processed.flatMap(Object.keys)));
      // Sort keys by priority: known useful keys first, then by density (high to low), then alphabetical
      const priority = ['id', 'status', 'input_text', 'input.text', 'text', 'generated_sql', 'model_output.cleaned_sql'];

      keys.sort((a, b) => {
        const pA = priority.indexOf(a);
        const pB = priority.indexOf(b);
        if (pA !== -1 && pB !== -1) return pA - pB;
        if (pA !== -1) return -1;
        if (pB !== -1) return 1;
        // Higher density first
        if ((density[b] || 0) !== (density[a] || 0)) return (density[b] || 0) - (density[a] || 0);
        return a.localeCompare(b);
      });

      setKeyDensity(density);
      setAllKeys(keys.filter(k => k !== 'id' && k !== 'status'));

      setViewMode('list');
      setError(null);
    } else {
      setError("Could not find a valid array of data in the JSON.");
    }
  };

  const handleTransform = async (type: string) => {
    if (selectedIds.size === 0 && data.length === 0) return;

    setLoading(true);
    try {
      // If items are selected, only transform those, otherwise transform all
      const itemsToTransform = selectedIds.size > 0
        ? data.filter(d => selectedIds.has(d.id))
        : data;

      const response = await axios.post('/api/transform', {
        data: itemsToTransform,
        transformation_type: type
      });

      if (response.data && Array.isArray(response.data.data)) {
        // Merge transformed data back into state
        const transformedMap = new Map(response.data.data.map((d: any) => [d.id, d]));

        setData(prev => prev.map(d => (transformedMap.get(d.id) || d) as DataRecord));

        // If we transformed everything, just replace
        if (selectedIds.size === 0) {
          setData(response.data.data);
        }
      }
    } catch (err) {
      setError("Transformation failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    const itemsToExport = selectedIds.size > 0
      ? data.filter(d => selectedIds.has(d.id))
      : data;

    if (itemsToExport.length === 0) return;

    try {
      // In a real app we might POST to get a signed URL, 
      // but for client-side download of small datasets:
      const blob = new Blob([JSON.stringify(itemsToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export_${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Export failed.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200">

      {/* Navbar */}
      <nav className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <FileJson className="h-6 w-6 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight">AI Data Inspector</span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setViewMode('ingest')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${viewMode === 'ingest' ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                Ingest
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                Insepect
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-md flex items-center gap-3 text-red-700 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-sm hover:underline">Dismiss</button>
          </div>
        )}

        {viewMode === 'ingest' && (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">Import Data</h2>
              <p className="text-gray-500 dark:text-gray-400">Upload a JSON file or paste raw content to get started.</p>
            </div>

            <div
              className="bg-white dark:bg-gray-900 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 border-dashed border-2 flex flex-col items-center justify-center gap-4 transition-colors hover:border-blue-500 dark:hover:border-blue-500/50"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      const json = JSON.parse(event.target?.result as string);
                      processIngestedData(json);
                    } catch (err) {
                      setError("Invalid JSON file.");
                    }
                  };
                  reader.readAsText(file);
                }
              }}
            >
              <Upload className="h-12 w-12 text-gray-400" />
              <div className="text-center">
                <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-900 rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                  <span>Upload a file</span>
                  <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".json" onChange={handleFileUpload} />
                </label>
                <p className="pl-1 text-gray-500 dark:text-gray-400">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">JSON files up to 10MB</p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="px-2 bg-gray-100 dark:bg-gray-950 text-sm text-gray-500">Or paste raw JSON</span>
              </div>
            </div>

            <div>
              <textarea
                rows={8}
                className="block w-full rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm font-mono"
                placeholder='[{"id": 1, "input_text": "..."}]'
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
              />
              <button
                onClick={handlePasteIngest}
                disabled={!rawInput}
                className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Process JSON
              </button>
            </div>
          </div>
        )}

        {viewMode === 'list' && (
          <div className="space-y-6">
            {/* Actions Toolbar */}
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <h2 className="text-xl font-semibold">Dataset ({data.length} records)</h2>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-700 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Reload
                </button>

                <div className="relative group">
                  <button className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500">
                    <Play className="h-4 w-4 mr-2" />
                    Transform
                  </button>
                  {/* Dropdown for transforms */}
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 z-10 hidden group-hover:block">
                    <button onClick={() => handleTransform('normalize_sql')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Normalize SQL</button>
                    <button onClick={() => handleTransform('openai_format')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Format for OpenAI</button>
                    <button onClick={() => handleTransform('validate_bbox')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Validate BBox</button>
                  </div>
                </div>

                <button
                  onClick={handleExport}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export {selectedIds.size > 0 ? `(${selectedIds.size})` : 'All'}
                </button>
              </div>
            </div>

            <DataList
              data={filteredData}
              allKeys={allKeys}
              keyDensity={keyDensity}
              selectedIds={selectedIds}
              searchTerm={searchTerm}
              onToggleSelect={(id) => {
                const newSet = new Set(selectedIds);
                if (newSet.has(id)) newSet.delete(id);
                else newSet.add(id);
                setSelectedIds(newSet);
              }}
              onSelectAll={({ selectAll }) => {
                if (selectAll) {
                  // Select all currently visible (filtered) items
                  const newIds = new Set(selectedIds);
                  filteredData.forEach(d => newIds.add(d.id));
                  setSelectedIds(newIds);
                } else {
                  // Deselect all currently visible items
                  const newIds = new Set(selectedIds);
                  filteredData.forEach(d => newIds.delete(d.id));
                  setSelectedIds(newIds);
                }
              }}
              onSearch={setSearchTerm}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
