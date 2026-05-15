import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Header() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) return null

  const isActive = (path: string) => location.pathname === path

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link to="/stores" className="app-header__logo">
          <span className="app-header__logo-icon">◆</span>
          Compras Bonificadas
        </Link>

        <nav className="app-header__nav">
          <Link
            to="/stores"
            className={`app-header__link ${isActive('/stores') ? 'app-header__link--active' : ''}`}
          >
            Ofertas
          </Link>
          {isAdmin() && (
            <Link
              to="/admin"
              className={`app-header__link ${isActive('/admin') ? 'app-header__link--active' : ''}`}
            >
              Admin
            </Link>
          )}
        </nav>

        <div className="app-header__user">
          <span className="app-header__user-name">{user?.name || user?.email}</span>
          <button onClick={logout} className="app-header__logout">
            Sair
          </button>
        </div>
      </div>
    </header>
  )
}
