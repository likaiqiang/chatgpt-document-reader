import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  rebuildConfig: {},
  makers:[
    {
      name: "@electron-forge/maker-dmg",
      platforms: ["darwin"],
      config: {
        // your dmg config
      },
    },
    {
      name: "@electron-forge/maker-squirrel",
      platforms: ["win32"],
      config: {
        // your squirrel config
      },
    },
    {
      name: "@electron-forge/maker-deb",
      platforms:["linux"],
      config:{

      }
    }
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
  publishers: [
    {
      "name": "@electron-forge/publisher-github",
      "platforms": ['darwin', 'win32','linux'],
      "config": {
        "repository": {
          "owner": "likaiqiang",
          "name": "pdf-chatbot"
        },
        "prerelease": false,
        "draft": true
      }
    }
  ]
};

export default config;
