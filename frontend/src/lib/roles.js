export const isAdmin = (user) =>
  user?.role === 'superadmin' || user?.role === 'admin'

export const isSuperadmin = (user) =>
  user?.role === 'superadmin'
