<div align="center">
<h1> Grafana Dashboard to Scenes App</h1>

<small>Converter for transforming dashboard yaml/json definitions to a React scenes application</small>
</div>

---

## Getting Started

```bash
npm install -g grafana-dashboard-to-scenes

dashboards-to-scenes -i ./dashboards -o ./scenes-app
```

### Additional Parameters

- `-n,--name`: Define the name your generated application will have
- `-r,--recursive`: Dive deeper into subdirectories to find all dashboards
- `-s,--css`: Provide a css file that will be injected in your application, e.g. [modern-scenes.css](./examples/modern-scenes.css)
- `-c,--colors`: Provide a json file with a mapping between grafana colors and your theme, e.g. [colors.json](./examples/colors.json) 

## Known Issues

> Currently there is still a bug leading the typecheck in the generated typescript panels to fail. A workaround is to add a `// @ts-nocheck` at the top of each generated dashboard.

## License

[MIT](./LICENSE.md)
