import React, { JSX } from 'react';
import { UpgradeContextValue, UpgradeProviderProps } from '../interfaces/interfaces';

const UpgradeCtx = React.createContext<UpgradeContextValue>({
  onUpgradePress: () => {},
});

export const useUpgrade = () => React.useContext(UpgradeCtx);

export function UpgradeProvider({ onUpgradePress, children }: UpgradeProviderProps): JSX.Element {
  return (
    <UpgradeCtx.Provider value={{ onUpgradePress }}>
      {children}
    </UpgradeCtx.Provider>
  );
}