import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppShell from './components/shell/AppShell'
import HomePage from './pages/HomePage'
import AccountPage from './pages/AccountPage'
import CatalogPage from './pages/CatalogPage'
import StockHubPage from './pages/StockHubPage'
import StorefrontPage from './pages/StorefrontPage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="account"    element={<AccountPage />} />
          <Route path="catalog"    element={<CatalogPage />} />
          <Route path="stockhub"   element={<StockHubPage />} />
          <Route path="storefront" element={<StorefrontPage />} />
          <Route path="dashboard"  element={<DashboardPage />} />
          <Route path="settings"   element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
