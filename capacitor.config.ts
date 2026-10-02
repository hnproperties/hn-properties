import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hnproperties.app',
  appName: 'HNProperties',
  webDir: 'out',
  server: {
    url: 'http://192.168.1.6:3000',
    cleartext: true,
  },
};

export default config;
