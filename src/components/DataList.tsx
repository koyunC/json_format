import React, { useState, useEffect } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Search, Columns, ChevronDown } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface DataRecord {
    id: string | number;
    status?: string;
    [key: string]: any;
}

interface DataListProps {
    data: DataRecord[];
    allKeys: string[];
    keyDensity?: Record<string, number>;
    selectedIds: Set<string | number>;
    onToggleSelect: (id: string | number) => void;
    onSelectAll: (params: { selectAll: boolean }) => void;
    onSearch: (query: string) => void;
    searchTerm: string;
}

export const DataList: React.FC<DataListProps> = ({
    data,
    allKeys,
    keyDensity,
    selectedIds,
    onToggleSelect,
    onSelectAll,
    onSearch,
    searchTerm,
}) => {
    // Local state for columns only
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
    const [showColumnMenu, setShowColumnMenu] = useState(false);

    // Default visible columns: 
    // If total keys <= 6, show all.
    // Otherwise, show first 5 (which are now sorted by priority/density).
    useEffect(() => {
        if (allKeys.length > 0 && visibleColumns.size === 0) {
            const defaults = new Set<string>();

            if (allKeys.length <= 6) {
                allKeys.forEach(k => defaults.add(k));
            } else {
                allKeys.slice(0, 5).forEach(k => defaults.add(k));
            }
            setVisibleColumns(defaults);
        }
    }, [allKeys]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onSearch(e.target.value);
    };

    const toggleColumn = (key: string) => {
        const newSet = new Set(visibleColumns);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        setVisibleColumns(newSet);
    };

    const allSelected = data.length > 0 && data.every((d) => selectedIds.has(d.id));

    // Data is now pre-filtered by parent
    const filteredData = data;

    return (
        <div className="w-full bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col h-[600px]">
            {/* Header / Toolbar */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50 dark:bg-gray-900/50 shrink-0">
                <div className="relative w-full md:w-96">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out"
                        placeholder="Search records..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                    />
                </div>

                <div className="flex items-center space-x-2 relative">
                    <div className="relative">
                        <button
                            onClick={() => setShowColumnMenu(!showColumnMenu)}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-700 text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <Columns className="h-4 w-4 mr-2" />
                            Columns
                            <ChevronDown className="h-3 w-3 ml-2 text-gray-400" />
                        </button>

                        {showColumnMenu && (
                            <div
                                className="absolute right-0 mt-2 w-56 rounded-md shadow-2xl border border-gray-200 dark:border-gray-700 py-1 z-[100] max-h-96 overflow-y-auto"
                                style={{ backgroundColor: 'var(--bg-menu, #ffffff)' }}
                            >
                                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 uppercase bg-gray-100 dark:bg-gray-800">
                                    Toggle Columns
                                </div>
                                {allKeys.map(key => (
                                    <label key={key} className="flex items-center px-4 py-2 hover:!bg-white !dark:bg-gray-900 bg-opacity-100 cursor-pointer justify-between group">
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                checked={visibleColumns.has(key)}
                                                onChange={() => toggleColumn(key)}
                                            />
                                            <span className="ml-2 text-sm text-gray-700 dark:text-gray-200 truncate max-w-[120px]" title={key}>{key}</span>
                                        </div>
                                        {keyDensity && (
                                            <span className="text-xs text-gray-400 group-hover:text-gray-500">
                                                {Math.round((keyDensity[key] / data.length) * 100)}%
                                            </span>
                                        )}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 relative">
                    <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12 bg-gray-50 dark:bg-gray-800">
                                <input
                                    type="checkbox"
                                    className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                                    checked={allSelected}
                                    onChange={(e) => onSelectAll({ selectAll: e.target.checked })}
                                />
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800 min-w-[150px]">
                                ID / Status
                            </th>
                            {Array.from(visibleColumns).map(key => (
                                <th key={key} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800 min-w-[200px]">
                                    {key}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                        {filteredData.map((record) => {
                            const isSelected = selectedIds.has(record.id);
                            return (
                                <tr
                                    key={record.id}
                                    className={cn(
                                        "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer",
                                        isSelected && "bg-blue-50 dark:bg-blue-900/10"
                                    )}
                                    onClick={() => onToggleSelect(record.id)}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                                            checked={isSelected}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                onToggleSelect(record.id)
                                            }}
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[100px]" title={String(record.id)}>
                                            {record.id}
                                        </div>
                                        <span className={cn(
                                            "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1",
                                            record.status === 'verified' || record.status === 'completed' ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" :
                                                record.status === 'error' || record.status === 'flagged' ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" :
                                                    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                                        )}>
                                            {record.status || 'pending'}
                                        </span>
                                    </td>
                                    {Array.from(visibleColumns).map(key => (
                                        <td key={key} className="px-6 py-4">
                                            <div className="text-sm text-gray-900 dark:text-gray-300 max-h-24 overflow-y-auto w-full">
                                                {typeof record[key] === 'object' ? (
                                                    <pre className="text-xs">{JSON.stringify(record[key], null, 2)}</pre>
                                                ) : String(record[key] ?? '')}
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            )
                        })}

                        {filteredData.length === 0 && (
                            <tr>
                                <td colSpan={2 + visibleColumns.size} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                    No records found. Upload a file or adjust filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 px-6 py-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {filteredData.length} records
                </span>
            </div>
        </div>
    );
};
