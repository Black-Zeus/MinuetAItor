import React from "react";

import ReactECharts from "./echartsRuntime";

const AsyncEChart = React.forwardRef(
  (
    {
      option,
      style = { height: 320, width: "100%" },
      className = "",
      fallback,
      loadingFallback,
      ...rest
    },
    ref
  ) => (
    <ReactECharts
      ref={ref}
      option={option}
      style={style}
      className={className}
      notMerge
      lazyUpdate
      opts={{ renderer: "canvas" }}
      {...rest}
    />
  )
);

AsyncEChart.displayName = "AsyncEChart";

export default AsyncEChart;
