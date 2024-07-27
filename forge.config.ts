import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  rebuildConfig: {
    onlyModules:[]
  },
  packagerConfig:{
    ignore: (file) => {
      if (!file) return false;
      return (
        !/^[/\\]package.json$/.test(file) &&
        !/^[/\\]\.vite($|[/\\]).*$/.test(file)
      );
    }
  },
  makers:[
    {
      name: "@electron-forge/maker-zip",
      platforms: ['darwin', 'linux', 'win32'],
      config: {
        name:'chatgpt-document-reader'
      },
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
          config: 'vite.main.config.mts',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      renderer: [
        {
          name: 'search_window',
          config: 'vite.renderer.search.config.ts'
        },
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        }
      ],
    }),
  ]
};

export default config;
