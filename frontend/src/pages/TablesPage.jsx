import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { tablesAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { 
  Users, 
  Clock, 
  DollarSign, 
  RefreshCw,
  Filter,
  Search
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function TablesPage() {
  const [tables, setTables] = useState([])
  const [summary, setSummary] = useState(null)
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all', 'available', 'occupied'
  const [selectedSection, setSelectedSection] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()
  const { user } = useAuth()

  // Fetch tables
  const fetchTables = useCallback(async () => {
    try {
      const [tablesRes, summaryRes, sectionsRes] = await Promise.all([
        tablesAPI.getAll(),
        tablesAPI.getSummary(),
        tablesAPI.getSections()
      ])
      
      setTables(tablesRes.data.data)
      setSummary(summaryRes.data.data)
      setSections(sectionsRes.data.data)
    } catch (error) {
      console.error('Failed to fetch tables:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTables()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchTables, 30000)
    return () => clearInterval(interval)
  }, [fetchTables])

  // Handle table click
  const handleTableClick = (table) => {
    if (table.status === 'maintenance') return
    navigate(`/order/${table.id}`)
  }

  // Filter tables
  const filteredTables = tables.filter(table => {
    // Status filter
    if (filter !== 'all' && table.status !== filter) return false
    
    // Section filter
    if (selectedSection !== 'all' && table.section !== selectedSection) return false
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return table.table_number.toString().includes(query) ||
             table.section?.toLowerCase().includes(query)
    }
    
    return true
  })

  // Group tables by section
  const tablesBySection = filteredTables.reduce((acc, table) => {
    const section = table.section || 'Other'
    if (!acc[section]) acc[section] = []
    acc[section].push(table)
    return acc
  }, {})

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0)
  }

  return (
    <div className="min-h-screen p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-surface-800">
            Table Management
          </h1>
          <p className="text-surface-500">
            Welcome, {user?.fullName}
          </p>
        </div>

        <button
          onClick={fetchTables}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card p-4">
            <div className="text-sm text-surface-500 mb-1">Total Tables</div>
            <div className="text-2xl font-bold text-surface-800">{summary.total}</div>
          </div>
          <div className="card p-4 border-l-4 border-l-green-500">
            <div className="text-sm text-surface-500 mb-1">Available</div>
            <div className="text-2xl font-bold text-green-600">{summary.available}</div>
          </div>
          <div className="card p-4 border-l-4 border-l-orange-500">
            <div className="text-sm text-surface-500 mb-1">Occupied</div>
            <div className="text-2xl font-bold text-orange-600">{summary.occupied}</div>
          </div>
          <div className="card p-4 border-l-4 border-l-blue-500">
            <div className="text-sm text-surface-500 mb-1">Reserved</div>
            <div className="text-2xl font-bold text-blue-600">{summary.reserved}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
            <input
              type="text"
              placeholder="Search table number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Status Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('available')}
              className={`btn ${filter === 'available' ? 'bg-green-500 text-white hover:bg-green-600' : 'btn-secondary'}`}
            >
              Available
            </button>
            <button
              onClick={() => setFilter('occupied')}
              className={`btn ${filter === 'occupied' ? 'bg-orange-500 text-white hover:bg-orange-600' : 'btn-secondary'}`}
            >
              Occupied
            </button>
          </div>

          {/* Section Filter */}
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="input max-w-[200px]"
          >
            <option value="all">All Sections</option>
            {sections.map(section => (
              <option key={section.section} value={section.section}>
                {section.section} ({section.table_count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tables Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner w-8 h-8"></div>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(tablesBySection).map(([section, sectionTables]) => (
            <div key={section}>
              <h2 className="text-lg font-semibold text-surface-700 mb-4 flex items-center gap-2">
                <Filter className="w-5 h-5" />
                {section}
                <span className="text-sm font-normal text-surface-400">
                  ({sectionTables.length} tables)
                </span>
              </h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {sectionTables.map((table) => (
                  <div
                    key={table.id}
                    onClick={() => handleTableClick(table)}
                    className={`table-card ${table.status}`}
                  >
                    {/* Table Number */}
                    <div className="text-2xl font-bold text-center mb-2">
                      {table.table_number}
                    </div>

                    {/* Capacity */}
                    <div className="flex items-center justify-center gap-1 text-sm text-surface-500 mb-2">
                      <Users className="w-4 h-4" />
                      {table.capacity}
                    </div>

                    {/* Status indicator */}
                    <div className={`text-xs font-medium text-center py-1 px-2 rounded-full ${
                      table.status === 'available' ? 'bg-green-100 text-green-700' :
                      table.status === 'occupied' ? 'bg-orange-100 text-orange-700' :
                      table.status === 'reserved' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {table.status.charAt(0).toUpperCase() + table.status.slice(1)}
                    </div>

                    {/* Order info if occupied */}
                    {table.status === 'occupied' && table.current_order_id && (
                      <div className="mt-3 pt-3 border-t border-orange-200">
                        <div className="flex items-center justify-between text-xs text-surface-600 mb-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {table.order_opened_at 
                              ? formatDistanceToNow(new Date(table.order_opened_at), { addSuffix: false })
                              : '-'
                            }
                          </span>
                        </div>
                        <div className="flex items-center justify-center text-sm font-semibold text-orange-700">
                          <DollarSign className="w-4 h-4" />
                          {formatCurrency(table.current_total)}
                        </div>
                        {table.server_name && (
                          <div className="text-xs text-center text-surface-500 mt-1 truncate">
                            {table.server_name}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filteredTables.length === 0 && (
            <div className="text-center py-12 text-surface-500">
              No tables found matching your criteria
            </div>
          )}
        </div>
      )}
    </div>
  )
}
