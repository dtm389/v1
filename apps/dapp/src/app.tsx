import { Provider } from '@defi-token/blockchain';
import Home from './pages/home';
import { QueryClient } from '@tanstack/react-query';
import { Route, Routes } from 'react-router-dom';
import NotFoundPage from './pages/not-found';
import SignInPage from './pages/sign-in';

export function App() {
  const queryClient = new QueryClient();

  return (
    <Provider configProvider="rainbow" queryClient={queryClient}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Provider>
  );
}

export default App;
