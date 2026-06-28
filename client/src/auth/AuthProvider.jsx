import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig, apiRequest } from './msalConfig';
import { setTokenGetter } from '../api';

const msalInstance = new PublicClientApplication(msalConfig);

// Wire the API module to silently acquire a fresh token before every request
setTokenGetter(async () => {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) return null;
  try {
    const result = await msalInstance.acquireTokenSilent({
      ...apiRequest,
      account: accounts[0],
    });
    return result.accessToken;
  } catch {
    return null;
  }
});

export default function AuthProvider({ children }) {
  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}
