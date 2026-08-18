import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.omfin.app',
  appName: 'OmFin',
  webDir: 'www',
  plugins: {
    FirebaseAuthentication: {
      providers: ['google.com']
    },
    CapacitorSQLite: {
      androidIsEncryption: false
    }
  }
};

export default config;
