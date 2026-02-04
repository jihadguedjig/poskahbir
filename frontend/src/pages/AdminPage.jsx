import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usersAPI, productsAPI, categoriesAPI, paymentsAPI, paymentMethodsAPI, tablesAPI, uploadsAPI, getProductImageUrl } from '../services/api'
import toast from 'react-hot-toast'
import {
  Users,
  Package,
  BarChart3,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Save,
  Search,
  Calendar,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Image as ImageIcon,
  Printer,
  Shield,
  FolderOpen,
  CreditCard,
  LayoutGrid
} from 'lucide-react'
import { format, subDays } from 'date-fns'
import { formatCurrency } from '../utils/currency'

// Users Management Component (moderator: only servers & cashiers)
function UsersManagement({ isModerator = false }) {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    pin: '',
    role_id: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        usersAPI.getAll(),
        usersAPI.getRoles()
      ])
      let userList = usersRes.data.data || []
      const roleList = rolesRes.data.data || []
      if (isModerator) {
        userList = userList.filter(u => u.role_name === 'server' || u.role_name === 'cashier')
      }
      setUsers(userList)
      setRoles(roleList)
    } catch (error) {
      toast.error('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingUser) {
        await usersAPI.update(editingUser.id, {
          full_name: formData.full_name,
          role_id: parseInt(formData.role_id),
          is_active: formData.is_active
        })
        toast.success('User updated')
      } else {
        await usersAPI.create({
          ...formData,
          role_id: parseInt(formData.role_id)
        })
        toast.success('User created')
      }
      setShowForm(false)
      setEditingUser(null)
      setFormData({ username: '', full_name: '', pin: '', role_id: '' })
      fetchData()
    } catch (error) {
      // Error handled by API interceptor
    }
  }

  const handleEdit = (user) => {
    setEditingUser(user)
    setFormData({
      username: user.username,
      full_name: user.full_name,
      role_id: user.role_id.toString(),
      is_active: user.is_active
    })
    setShowForm(true)
  }

  const handleDelete = async (user) => {
    if (!confirm(`Deactivate user "${user.full_name}"?`)) return
    try {
      await usersAPI.delete(user.id)
      toast.success('User deactivated')
      fetchData()
    } catch (error) {
      // Error handled by API interceptor
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="spinner"></div></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-surface-800">User Management</h2>
        <button
          onClick={() => {
            setEditingUser(null)
            const defaultRole = isModerator
              ? roles.find(r => r.name === 'server' || r.name === 'cashier')
              : roles[0]
            setFormData({ username: '', full_name: '', pin: '', role_id: defaultRole?.id?.toString() || '' })
            setShowForm(true)
          }}
          className="btn btn-primary"
        >
          <Plus className="w-5 h-5 mr-2" /> Add User
        </button>
      </div>

      {/* User Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md m-4">
            <h3 className="text-lg font-bold mb-4">
              {editingUser ? 'Edit User' : 'Add New User'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="input"
                    disabled={!!editingUser}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-surface-600 mb-1">PIN (4-8 digits)</label>
                    <input
                      type="password"
                      value={formData.pin}
                      onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                      className="input"
                      pattern="\d{4,8}"
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">Role</label>
                  <select
                    value={formData.role_id}
                    onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                    className="input"
                    required
                  >
                    {(isModerator ? roles.filter(r => r.name === 'server' || r.name === 'cashier') : roles).map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
                {editingUser && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    <label htmlFor="is_active" className="text-sm">Active</label>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  <Save className="w-4 h-4 mr-2" /> Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-surface-600">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-surface-600">Username</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-surface-600">Role</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-surface-600">Status</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-surface-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-t border-surface-100">
                <td className="px-4 py-3 font-medium">{user.full_name}</td>
                <td className="px-4 py-3 text-surface-500">{user.username}</td>
                <td className="px-4 py-3">
                  <span className="badge bg-primary-100 text-primary-700 capitalize">{user.role_name}</span>
                </td>
                <td className="px-4 py-3">
                  {user.is_active ? (
                    <span className="badge badge-success">Active</span>
                  ) : (
                    <span className="badge badge-danger">Inactive</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleEdit(user)} className="text-surface-500 hover:text-primary-500 mr-3">
                    <Edit className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleDelete(user)} className="text-surface-500 hover:text-red-500">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Categories Management Component
function CategoriesManagement() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    display_order: 0,
    color: '#3B82F6',
    icon: '',
    image_url: ''
  })

  const fetchData = async () => {
    try {
      const res = await categoriesAPI.getAll({ include_inactive: true })
      setCategories(res.data.data || [])
    } catch (error) {
      toast.error('Failed to fetch categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = {
        ...formData,
        display_order: parseInt(formData.display_order) || 0
      }
      if (editingCategory) {
        await categoriesAPI.update(editingCategory.id, data)
        toast.success('Category updated')
      } else {
        await categoriesAPI.create(data)
        toast.success('Category created')
      }
      setShowForm(false)
      setEditingCategory(null)
      setFormData({ name: '', description: '', display_order: 0, color: '#3B82F6', icon: '', image_url: '' })
      fetchData()
    } catch (error) {
      // Error handled by API interceptor
    }
  }

  const handleEdit = (cat) => {
    setEditingCategory(cat)
    setFormData({
      name: cat.name,
      description: cat.description || '',
      display_order: cat.display_order ?? 0,
      color: cat.color || '#3B82F6',
      icon: cat.icon || '',
      image_url: cat.image_url || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (cat) => {
    if (!confirm(`Deactivate category "${cat.name}"? Products in this category will need to be moved or deactivated first.`)) return
    try {
      await categoriesAPI.delete(cat.id)
      toast.success('Category deactivated')
      fetchData()
    } catch (error) {
      // Error handled by API interceptor
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="spinner"></div></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-surface-800">Category Management</h2>
        <button
          onClick={() => {
            setEditingCategory(null)
            setFormData({ name: '', description: '', display_order: 0, color: '#3B82F6', icon: '', image_url: '' })
            setShowForm(true)
          }}
          className="btn btn-primary"
        >
          <Plus className="w-5 h-5 mr-2" /> Add Category
        </button>
      </div>

      {/* Category Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md m-4 max-h-[90vh] overflow-auto">
            <h3 className="text-lg font-bold mb-4">{editingCategory ? 'Edit Category' : 'Add Category'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">Display order</label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                    className="input"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">Color</label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="h-10 w-full rounded border border-surface-200 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">Category image</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="input"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setImageUploading(true)
                      try {
                        const res = await uploadsAPI.uploadCategoryImage(file)
                        const url = res?.data?.data?.url
                        if (url) setFormData(prev => ({ ...prev, image_url: url }))
                      } catch (err) {
                        toast.error('Image upload failed')
                      } finally {
                        setImageUploading(false)
                        e.target.value = ''
                      }
                    }}
                  />
                  {imageUploading && <p className="text-xs text-surface-500 mt-1">Uploading…</p>}
                  {formData.image_url && (
                    <div className="mt-2 flex items-center gap-2">
                      <img
                        src={getProductImageUrl(formData.image_url)}
                        alt="Preview"
                        className="w-16 h-16 object-cover rounded border border-surface-200"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  <Save className="w-4 h-4 mr-2" /> Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categories.map(cat => (
          <div key={cat.id} className={`card p-4 ${!cat.is_active ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-14 h-14 rounded-lg bg-surface-100 flex items-center justify-center overflow-hidden shrink-0">
                {cat.image_url ? (
                  <img
                    src={getProductImageUrl(cat.image_url)}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FolderOpen className="w-7 h-7 text-surface-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-surface-800">{cat.name}</h3>
                {cat.description && (
                  <p className="text-sm text-surface-500 line-clamp-2 mt-0.5">{cat.description}</p>
                )}
                <span className="text-xs text-surface-400 mt-1">Order: {cat.display_order} · {cat.product_count ?? 0} products</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-3 border-t border-surface-100">
              <button onClick={() => handleEdit(cat)} className="text-surface-500 hover:text-primary-500">
                <Edit className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(cat)} className="text-surface-500 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
              {cat.color && (
                <span
                  className="w-4 h-4 rounded-full border border-surface-200 shrink-0"
                  style={{ backgroundColor: cat.color }}
                  title={cat.color}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Products Management Component
function ProductsManagement() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    price: '',
    image_url: '',
    is_available: true,
    variable_price: false
  })
  const [imageUploading, setImageUploading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        productsAPI.getAll(),
        categoriesAPI.getAll()
      ])
      setProducts(productsRes.data.data)
      setCategories(categoriesRes.data.data)
    } catch (error) {
      toast.error('Failed to fetch products')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = {
        ...formData,
        category_id: parseInt(formData.category_id),
        price: parseFloat(formData.price)
      }
      
      if (editingProduct) {
        await productsAPI.update(editingProduct.id, data)
        toast.success('Product updated')
      } else {
        await productsAPI.create(data)
        toast.success('Product created')
      }
      setShowForm(false)
      setEditingProduct(null)
      fetchData()
    } catch (error) {
      // Error handled by API interceptor
    }
  }

  const handleEdit = (product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      description: product.description || '',
      category_id: product.category_id.toString(),
      price: product.price.toString(),
      image_url: product.image_url || '',
      is_available: product.is_available,
      variable_price: !!product.variable_price
    })
    setShowForm(true)
  }

  const handleToggleAvailability = async (product) => {
    try {
      await productsAPI.toggleAvailability(product.id, !product.is_available)
      fetchData()
    } catch (error) {
      // Error handled by API interceptor
    }
  }

  const filteredProducts = products.filter(product => {
    if (selectedCategory !== 'all' && product.category_id !== parseInt(selectedCategory)) return false
    if (searchQuery) {
      return product.name.toLowerCase().includes(searchQuery.toLowerCase())
    }
    return true
  })

  if (loading) {
    return <div className="flex justify-center py-8"><div className="spinner"></div></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-surface-800">Product Management</h2>
        <button
          onClick={() => {
            setEditingProduct(null)
            setFormData({ name: '', description: '', category_id: categories[0]?.id.toString() || '', price: '', is_available: true })
            setShowForm(true)
          }}
          className="btn btn-primary"
        >
          <Plus className="w-5 h-5 mr-2" /> Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="input max-w-[200px]"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md m-4">
            <h3 className="text-lg font-bold mb-4">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">Category</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="input"
                    required
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">Price (DH)</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="input"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">Product image</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="input"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setImageUploading(true)
                      try {
                        const res = await uploadsAPI.uploadProductImage(file)
                        const url = res?.data?.data?.url
                        if (url) setFormData(prev => ({ ...prev, image_url: url }))
                      } catch (err) {
                        toast.error('Image upload failed')
                      } finally {
                        setImageUploading(false)
                        e.target.value = ''
                      }
                    }}
                  />
                  {imageUploading && <p className="text-xs text-surface-500 mt-1">Uploading…</p>}
                  {formData.image_url && (
                    <div className="mt-2 flex items-center gap-2">
                      <img
                        src={getProductImageUrl(formData.image_url)}
                        alt="Preview"
                        className="w-16 h-16 object-cover rounded border border-surface-200"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_available"
                      checked={formData.is_available}
                      onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                    />
                    <label htmlFor="is_available" className="text-sm">Available for sale</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="variable_price"
                      checked={formData.variable_price}
                      onChange={(e) => setFormData({ ...formData, variable_price: e.target.checked })}
                    />
                    <label htmlFor="variable_price" className="text-sm">Variable price (server sets price when adding to order)</label>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  <Save className="w-4 h-4 mr-2" /> Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProducts.map(product => (
          <div key={product.id} className={`card p-4 ${!product.is_available ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-surface-800">{product.name}</h3>
                <span className="text-xs text-surface-500">{product.category_name}</span>
                {product.variable_price && (
                  <span className="block text-xs text-amber-600 mt-0.5">Variable price</span>
                )}
              </div>
              <span className="text-lg font-bold text-primary-600">{formatCurrency(product.price)}</span>
            </div>
            {product.description && (
              <p className="text-sm text-surface-500 mb-3 line-clamp-2">{product.description}</p>
            )}
            <div className="flex items-center justify-between pt-3 border-t border-surface-100">
              <button
                onClick={() => handleToggleAvailability(product)}
                className={`flex items-center gap-1 text-sm ${
                  product.is_available ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {product.is_available ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {product.is_available ? 'Available' : 'Unavailable'}
              </button>
              <button onClick={() => handleEdit(product)} className="text-surface-500 hover:text-primary-500">
                <Edit className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Reports Component (Admin only - day/period orders, sold products, revenues, server totals)
function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  })
  const [report, setReport] = useState(null)

  useEffect(() => {
    fetchReport()
  }, [dateRange])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const response = await paymentsAPI.getReport(dateRange.start, dateRange.end)
      setReport(response.data.data)
    } catch (error) {
      toast.error('Failed to fetch report')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => window.print()

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 print:hidden">
        <h2 className="text-xl font-bold text-surface-800">Sales Reports</h2>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-surface-400" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="input py-2"
            />
            <span className="text-surface-400">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="input py-2"
            />
          </div>
          <button onClick={handlePrint} className="btn btn-secondary flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Print Report
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="spinner"></div></div>
      ) : report ? (
        <div id="report-print-area">
          <div className="mb-4 print:mb-2">
            <h1 className="text-2xl font-bold text-surface-800">Showaya - Sales Report</h1>
            <p className="text-surface-500">Period: {dateRange.start} to {dateRange.end}</p>
          </div>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm text-surface-500">Total Orders</div>
                  <div className="text-2xl font-bold">{report.summary.totalOrders}</div>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <div className="text-sm text-surface-500">Total Sales</div>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(report.summary.totalSales)}</div>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <div className="text-sm text-surface-500">Avg Order Value</div>
                  <div className="text-2xl font-bold">{formatCurrency(report.summary.averageOrderValue)}</div>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <div className="text-sm text-surface-500">Total Tips</div>
                  <div className="text-2xl font-bold">{formatCurrency(report.summary.totalTips)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Server Totals */}
          {report.serverTotals?.length > 0 && (
            <div className="card p-4 mb-6">
              <h3 className="font-semibold text-surface-800 mb-4">Server Total Orders & Revenue</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface-100">
                      <th className="px-4 py-2 text-left text-sm font-medium text-surface-500">Server</th>
                      <th className="px-4 py-2 text-right text-sm font-medium text-surface-500">Orders</th>
                      <th className="px-4 py-2 text-right text-sm font-medium text-surface-500">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.serverTotals.map((row, i) => (
                      <tr key={i} className="border-b border-surface-50">
                        <td className="px-4 py-3 font-medium">{row.server_name}</td>
                        <td className="px-4 py-3 text-right">{row.order_count}</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-600">
                          {formatCurrency(row.total_sales)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Products */}
          <div className="card p-4 mb-6">
            <h3 className="font-semibold text-surface-800 mb-4">Top Selling Products</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-100">
                    <th className="px-4 py-2 text-left text-sm font-medium text-surface-500">Product</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-surface-500">Category</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-surface-500">Qty Sold</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-surface-500">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topProducts?.slice(0, 10).map((product, i) => (
                    <tr key={i} className="border-b border-surface-50">
                      <td className="px-4 py-3 font-medium">{product.product_name}</td>
                      <td className="px-4 py-3 text-surface-500">{product.category_name}</td>
                      <td className="px-4 py-3 text-right">{product.quantity_sold}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">
                        {formatCurrency(product.total_sales)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="card p-4">
            <h3 className="font-semibold text-surface-800 mb-4">Sales by Category</h3>
            <div className="space-y-3">
              {report.byCategory?.map((cat, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium">{cat.category_name}</span>
                      <span className="text-surface-500">{formatCurrency(cat.total_sales)}</span>
                    </div>
                    <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{
                          width: `${(cat.total_sales / (report.summary.totalSales || 1)) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// Payment Methods Management
function PaymentMethodsManagement() {
  const [methods, setMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingMethod, setEditingMethod] = useState(null)
  const [formData, setFormData] = useState({ name: '', description: '' })

  const fetchData = async () => {
    try {
      const res = await paymentMethodsAPI.getAll({ include_inactive: 'true' })
      setMethods(res.data.data || [])
    } catch (error) {
      toast.error('Failed to fetch payment methods')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = { name: formData.name, description: formData.description || '' }
      if (editingMethod) {
        payload.is_active = formData.is_active
        await paymentMethodsAPI.update(editingMethod.id, payload)
        toast.success('Payment method updated')
      } else {
        await paymentMethodsAPI.create(payload)
        toast.success('Payment method created')
      }
      setShowForm(false)
      setEditingMethod(null)
      setFormData({ name: '', description: '', is_active: true })
      fetchData()
    } catch (error) {}
  }

  const handleDelete = async (method) => {
    if (!confirm(`Deactivate payment method "${method.name}"?`)) return
    try {
      await paymentMethodsAPI.delete(method.id)
      toast.success('Payment method deactivated')
      fetchData()
    } catch (error) {}
  }

  if (loading) return <div className="flex justify-center py-8"><div className="spinner"></div></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-surface-800">Payment Methods</h2>
        <button onClick={() => { setEditingMethod(null); setFormData({ name: '', description: '', is_active: true }); setShowForm(true) }} className="btn btn-primary">
          <Plus className="w-5 h-5 mr-2" /> Add Method
        </button>
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md m-4">
            <h3 className="text-lg font-bold mb-4">{editingMethod ? 'Edit Payment Method' : 'Add Payment Method'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">Name</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">Description</label>
                  <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input" />
                </div>
                {editingMethod && (
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="is_active" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
                    <label htmlFor="is_active" className="text-sm">Active</label>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1"><Save className="w-4 h-4 mr-2" /> Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-surface-600">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-surface-600">Description</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-surface-600">Status</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-surface-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {methods.map(m => (
              <tr key={m.id} className="border-t border-surface-100">
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="px-4 py-3 text-surface-500">{m.description || '—'}</td>
                <td className="px-4 py-3">
                  {m.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Inactive</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => { setEditingMethod(m); setFormData({ name: m.name, description: m.description || '', is_active: m.is_active }); setShowForm(true) }} className="text-surface-500 hover:text-primary-500 mr-3"><Edit className="w-4 h-4" /></button>
                  {m.is_active && <button onClick={() => handleDelete(m)} className="text-surface-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Restaurant Tables Management
function TablesManagement() {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTable, setEditingTable] = useState(null)
  const [formData, setFormData] = useState({ table_number: '', capacity: 4, section: '', position_x: 0, position_y: 0, is_active: true })

  const fetchData = async () => {
    try {
      const res = await tablesAPI.getAll({ include_inactive: 'true' })
      setTables(res.data.data || [])
    } catch (error) {
      toast.error('Failed to fetch tables')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = { ...formData, table_number: parseInt(formData.table_number), capacity: parseInt(formData.capacity) || 4, position_x: parseInt(formData.position_x) || 0, position_y: parseInt(formData.position_y) || 0 }
      if (editingTable) {
        await tablesAPI.update(editingTable.id, data)
        toast.success('Table updated')
      } else {
        await tablesAPI.create(data)
        toast.success('Table created')
      }
      setShowForm(false)
      setEditingTable(null)
      setFormData({ table_number: '', capacity: 4, section: '', position_x: 0, position_y: 0, is_active: true })
      fetchData()
    } catch (error) {}
  }

  const handleDelete = async (table) => {
    if (!confirm(`Deactivate table ${table.table_number}? It must have no active order.`)) return
    try {
      await tablesAPI.delete(table.id)
      toast.success('Table deactivated')
      fetchData()
    } catch (error) {}
  }

  if (loading) return <div className="flex justify-center py-8"><div className="spinner"></div></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-surface-800">Restaurant Tables</h2>
        <button onClick={() => { setEditingTable(null); setFormData({ table_number: '', capacity: 4, section: '', position_x: 0, position_y: 0, is_active: true }); setShowForm(true) }} className="btn btn-primary">
          <Plus className="w-5 h-5 mr-2" /> Add Table
        </button>
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md m-4">
            <h3 className="text-lg font-bold mb-4">{editingTable ? 'Edit Table' : 'Add Table'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">Table number</label>
                  <input type="number" min={1} value={formData.table_number} onChange={(e) => setFormData({ ...formData, table_number: e.target.value })} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">Capacity</label>
                  <input type="number" min={1} max={50} value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-600 mb-1">Section</label>
                  <input type="text" value={formData.section} onChange={(e) => setFormData({ ...formData, section: e.target.value })} className="input" placeholder="e.g. Main, Window" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-surface-600 mb-1">Position X</label>
                    <input type="number" min={0} value={formData.position_x} onChange={(e) => setFormData({ ...formData, position_x: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-600 mb-1">Position Y</label>
                    <input type="number" min={0} value={formData.position_y} onChange={(e) => setFormData({ ...formData, position_y: e.target.value })} className="input" />
                  </div>
                </div>
                {editingTable && (
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="is_active" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
                    <label htmlFor="is_active" className="text-sm">Active</label>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1"><Save className="w-4 h-4 mr-2" /> Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-surface-600">#</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-surface-600">Section</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-surface-600">Capacity</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-surface-600">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-surface-600">Active</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-surface-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tables.map(t => (
              <tr key={t.id} className="border-t border-surface-100">
                <td className="px-4 py-3 font-bold">Table {t.table_number}</td>
                <td className="px-4 py-3 text-surface-500">{t.section || '—'}</td>
                <td className="px-4 py-3">{t.capacity}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${t.status === 'occupied' ? 'badge-warning' : t.status === 'available' ? 'badge-success' : 'bg-surface-100 text-surface-600'}`}>{t.status}</span>
                </td>
                <td className="px-4 py-3">{t.is_active ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => { setEditingTable(t); setFormData({ table_number: t.table_number, capacity: t.capacity, section: t.section || '', position_x: t.position_x ?? 0, position_y: t.position_y ?? 0, is_active: t.is_active }); setShowForm(true) }} className="text-surface-500 hover:text-primary-500 mr-3"><Edit className="w-4 h-4" /></button>
                  {t.is_active && !t.current_order_id && <button onClick={() => handleDelete(t)} className="text-surface-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Roles & Permissions (Admin only)
function RolesPage() {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    usersAPI.getRoles()
      .then(res => setRoles(res.data.data))
      .catch(() => toast.error('Failed to load roles'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-8"><div className="spinner"></div></div>

  return (
    <div>
      <h2 className="text-xl font-bold text-surface-800 mb-6">Roles & Permissions</h2>
      <div className="space-y-4">
        {roles.map(role => (
          <div key={role.id} className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-primary-500" />
              <h3 className="font-semibold text-surface-800 capitalize">{role.name}</h3>
              <span className="text-sm text-surface-500">— {role.description}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {typeof role.permissions === 'string' ? null : Object.entries(role.permissions || {}).map(([resource, actions]) => (
                <span key={resource} className="badge bg-surface-100 text-surface-700">
                  {resource}: {Array.isArray(actions) ? actions.join(', ') : actions}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Main Admin Page
export default function AdminPage() {
  const { hasRole } = useAuth()
  const isAdmin = hasRole('admin')

  const navItems = [
    { to: '/admin', icon: BarChart3, label: 'Reports', end: true, adminOnly: true },
    { to: '/admin/categories', icon: FolderOpen, label: 'Categories' },
    { to: '/admin/products', icon: Package, label: 'Products' },
    { to: '/admin/payment-methods', icon: CreditCard, label: 'Payment Methods' },
    { to: '/admin/tables', icon: LayoutGrid, label: 'Tables' },
    { to: '/admin/users', icon: Users, label: 'Users' },
    { to: '/admin/roles', icon: Shield, label: 'Roles & Permissions', adminOnly: true },
  ]

  const filteredNavItems = navItems.filter(item => 
    !item.adminOnly || isAdmin
  )

  return (
    <div className="min-h-screen bg-surface-100">
      {/* Admin / Moderation Header */}
      <header className="bg-white border-b border-surface-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-surface-800">{isAdmin ? 'Admin Panel' : 'Moderation'}</h1>
      </header>

      {/* Admin Navigation */}
      <nav className="bg-white border-b border-surface-200 px-6">
        <div className="flex gap-1 flex-wrap">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-surface-500 hover:text-surface-700'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Admin Content */}
      <div className="p-6">
        <Routes>
          <Route index element={isAdmin ? <ReportsPage /> : <Navigate to="/admin/products" replace />} />
          <Route path="categories" element={<CategoriesManagement />} />
          <Route path="products" element={<ProductsManagement />} />
          <Route path="payment-methods" element={<PaymentMethodsManagement />} />
          <Route path="tables" element={<TablesManagement />} />
          <Route path="users" element={<UsersManagement isModerator={!isAdmin} />} />
          <Route path="roles" element={isAdmin ? <RolesPage /> : <Navigate to="/admin/products" replace />} />
          <Route path="reports" element={isAdmin ? <ReportsPage /> : <Navigate to="/admin/products" replace />} />
        </Routes>
      </div>
    </div>
  )
}
