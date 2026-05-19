type DashboardFile = {
    sourceFile: string,
    uid: string,
    slug: string,
    title: string,
    description: string,
    tags: string[],
    editable: boolean,
    timeRange: { from: string, to: string },
    timezone: string,
    refresh: string,
    panels: any[],
    variables: any[],
    annotations: any[],
    links: any[],
}

type PanelGridPos = {
  x: number,
  y: number,
  w: number,
  h: number,
}

type DashboardPanel = {
    id: number,
    title: string,
    description: string,
    type: string,
    pluginVersion: string,
    datasource: string,
    targets: any[],
    gridPos: PanelGridPos,
    transformations: any[],
    fieldConfig: { defaults: any, overrides: any[] },
    options: any,
    links: any[],
    transparent: boolean,
    repeat: string|null,
    repeatDirection: string|null,
    maxDataPoints: number,
    interval: string,
    timeFrom: string,
    timeShift: string,
    hideTimeOverride: boolean,
    cacheTimeout: number,
    rowTitle: string|null,
}

type DashboardVariable = {
    name: string,
    label: string,
    description: string,
    type: string,
    hide: number,
    skipUrlSync: boolean,
    query: string,
    datasource: string,
    regex: string,
    sort: number,
    refresh: number,
    multi: boolean,
    includeAll: boolean,
    allValue: string|null,
    current: any,
    options: any[],
    // Used by interval/custom
    auto: boolean,
    auto_count: number,
    auto_min: number,
}

type DashboardAnnotation = {
    name: string,
    enable: boolean,
    iconColor: string,
    datasource: string,
    target: any,
    expr: string,
    hide: boolean,
    builtIn: number,
    type: string,
}

export { DashboardFile, DashboardPanel, DashboardVariable, DashboardAnnotation };
