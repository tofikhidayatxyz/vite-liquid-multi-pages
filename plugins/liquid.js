// liquid-plugin.js
import fs from 'fs/promises';
import path from 'path';
import { Liquid } from 'liquidjs';
import fx from 'mkdir-recursive';

export default function liquidPlugin(options = {}) {
  const liquid = new Liquid({
    root: [
      path.join(process.cwd(), 'src', 'liquid'),
      path.join(process.cwd(), 'src', 'images'),
    ],
    extname: '.liquid',
    ...options,
  });

  const jsonParse = (value) => {
    return JSON.parse(value);
  };
  const importAsset = async (file) => {
    try {
      const fileData = await fs.readFile(
        path.join(process.cwd(), './public/assets', file),
        'utf-8'
      );
      return fileData;
    } catch (e) {
      console.log(e);
      return `File not found: ${file}`;
    }
  };

  const liquidPathRewrites = Object.entries(options.paths).map(
    ([key, value]) => ({
      key,
      value: value,
    })
  );

  liquid.registerFilter('json_parse', jsonParse);
  liquid.registerFilter('asset', importAsset);
  liquid.registerFilter('layout', console.log);

  return {
    name: 'liquid-plugin',
    async load(id) {
      if (id.endsWith('.liquid') || id.endsWith('.liquid.html')) {
        const filePath = id.split('liquid/').pop();
        const templatePath = path.join(
          process.cwd(),
          'src',
          'liquid',
          filePath
        );

        const code = await fs.readFile(templatePath, 'utf-8');
        let rendered = await liquid.parseAndRender(code);
        rendered = rendered.replaceAll('@asset', '/assets');
        return rendered;
      }
    },
    async transformIndexHtml(html, ctx) {
      const outputFile = path.resolve(
        path.join(
          options.output,
          ctx.path.split('liquid/pages').pop().replace('.liquid', '')
        )
      );
      try {
        let fsd = outputFile.split('/');
        fsd.pop();
        fsd = fsd.join('/');
        await fx.mkdirSync(fsd);
      } catch (e) {}
      try {
        html = html.replaceAll('http:');
        await fs.writeFile(outputFile, html);
      } catch (e) {
        console.warn(e);
      }
      return html;
    },

    async resolveId(source) {
      // console.log(source)
      if (source.includes('@')) {
        let finalPath = source;
        for (const pth of liquidPathRewrites) {
          if (finalPath.includes(pth.key)) {
            finalPath = finalPath.split(pth.key).pop();
            finalPath = pth.key + finalPath;
            finalPath = finalPath
              .replaceAll(pth.key, pth.value.vite)
              .replaceAll('//', '/');
          }
        }
        return {
          id: finalPath,
          external: true,
        };
      }
    },
    build: {
      // Customize the input options to include all Liquid files in the "pages" directory
      async inputOptions() {
        const liquidPagesDir = path.join(
          process.cwd(),
          'src',
          'liquid',
          'pages'
        );

        // Use fs.promises.readdir to list all files in the "pages" directory
        const files = await fs.promises.readdir(liquidPagesDir);

        // Filter for Liquid files (ending with .liquid)
        const liquidFiles = files.filter(
          (file) => file.endsWith('.liquid') || file.endsWith('.liquid.html')
        );

        // Create an input object with all Liquid files
        const input = {};
        liquidFiles.forEach((file) => {
          const entryName = path.join('pages', file).replace(/\.liquid$/, '');
          input[entryName] = path.join(liquidPagesDir, file);
        });

        return { input };
      },
    },
    configureServer(server) {
      // Serve HTML during development and render Liquid templates based on URL
      server.middlewares.use(async (req, res, next) => {
        let templatePath;
        const url = req.url.split('?')[0];
        const requestPath = url === '/' ? '/index' : url; // Handle the root URL

        let paths = requestPath
          .replaceAll('.html', '')
          .replaceAll('.liquid', '');

        for (const pth of liquidPathRewrites) {
          paths = paths.replaceAll(pth.key, pth.value);
        }

        const potentialTemplatePaths = [
          path.join(
            process.cwd(),
            'src',
            'liquid',
            'pages',
            `${paths}.liquid.html`
          ),
          path.join(
            process.cwd(),
            'src',
            'liquid',
            'pages',
            paths,
            'index.liquid.html'
          ),
        ];

        for (const potentialPath of potentialTemplatePaths) {
          try {
            await fs.access(potentialPath);
            templatePath = potentialPath;
            break;
          } catch (err) {}
        }

        if (!templatePath) {
          next();
          return;
        }

        try {
          const content = await fs.readFile(templatePath, 'utf-8');
          let rendered = '';
          rendered += '<script type="module" src="/@vite/client"></script>';
          try {
            rendered += await liquid.parseAndRender(content);
          } catch (e) {
            rendered += e.message;
          }
          rendered = rendered
            .replaceAll('@asset', '/assets')
            .replaceAll('//', '');
          res.setHeader('Content-Type', 'text/html');
          res.end(rendered);
        } catch (err) {
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      });
      // console.log(server)
    },
  };
}
