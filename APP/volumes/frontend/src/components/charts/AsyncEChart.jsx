import React from "react";

import ReactECharts from "./echartsRuntime";

const AsyncEChart = ({
  option,
  style = { height: 320, width: "100%" },
  className = "",
  fallback,
  loadingFallback,
  ...rest
}) => (
  <ReactECharts
    option={option}
    style={style}
    className={className}
    notMerge
    lazyUpdate
    opts={{ renderer: "canvas" }}
    {...rest}
  />
);

export default AsyncEChart;
