// Simple type declarations for react-native-sha256
declare module 'react-native-sha256' {
  function sha256(text: string): Promise<string>;
  export { sha256 };
}