"use client";

interface Tab {
    id: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
}

interface TabNavigationProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
}

export function TabNavigation({ tabs, activeTab, onTabChange }: TabNavigationProps) {
    return (
        <div className="border-b border-gray-200 mb-6">
            <div className="flex gap-1 overflow-x-auto">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap
                border-b-2 -mb-px
                ${isActive
                                    ? 'text-gray-900 border-gray-900'
                                    : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
                                }
              `}
                        >
                            {Icon && <Icon className="w-4 h-4" />}
                            {tab.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
