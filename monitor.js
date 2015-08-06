"use strict";

// NOT containing in a function, so that we can access global variables
// (function() {

var monitorData = [];
var monitorSettings = {
  xScale: "none",
  destroy: true,
  rollingMeanWindow: 1,
  refreshInterval: 5000,
  keySettings: {}
};

/*
modified from:
http://stackoverflow.com/questions/11963352/plot-rolling-moving-average-in-d3-js
*/
var movingAvg = function(n) {
  return function (points) {
    points = points.map(function(each, index, array) {
      var to = index + n - 1;
      var subSeq, sum;
      if (to < points.length) {
        subSeq = array.slice(index, to + 1);
        sum = subSeq.reduce(function(a,b) {
          return [a[0] + b[0], a[1] + b[1]];
        });
        return sum.map(function(each) { return each / n; });
      }
      return undefined;
    });
    points = points.filter(function(each) { return typeof each !== 'undefined'; });
    // Note that one could re-interpolate the points
    // to form a basis curve (I think...)
    return points.join("L");
  };
};

function loadMonitorData() {
  $.get(
    "/monitor.json",
    undefined,
    undefined,
    "text"
  ).done(
    function(data) {
      // split by new line and remove empty strings
      var jsonStrings = data.split("\n").filter(Boolean);
      var arrayLength = jsonStrings.length;
      // only allowing adding new data
      for (var idx = monitorData.length; idx < arrayLength; idx++) {
        var elem = jsonStrings[idx];
        var d = JSON.parse(elem);
        d._idx = idx;
        monitorData.push(d);
      }
      // add per key settings
      var monitorKeys = _.spread(_.union)(_.map(monitorData, _.keys));
      _.forEach(monitorKeys, function(k) {
        if (!_.includes(monitorSettings.keySettings, k)) {
          monitorSettings.keySettings[k] = {
            name: k
          };
        }
      });
      refreshChart();
      setTimeout(loadMonitorData, monitorSettings.refreshInterval);
    }
  ).fail(
    function(err) {
      console.log("error loading monitor data");
      console.log(err);
    }
  );
}

function refreshChart() {
  $("#main-chart").empty();
  createChart();
}

function createChart() {
  console.log("refreshing chart");

  var margin = {top: 20, right: 20, bottom: 30, left: 40},
      width = 600 - margin.left - margin.right,
      height = 400 - margin.top - margin.bottom;

  var x = d3.scale.linear()
        .domain([0, monitorData.length + 15]) // FIXME
      .range([0, width]);

  var y = d3.scale.linear()
        .domain([0, 10]) // FIXME
        .range([height, 0]);

  var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .ticks(11) // FIXME parameterize
        .tickSize(-height);

  var yAxis = d3.svg.axis()
      .scale(y)
      .orient("left")
      .ticks(11)  // FIXME parameterize
      .tickSize(-width);

  var vis = d3.select("#main-chart")
    .selectAll("svg")
        .data([monitorData])
    .enter().append("svg:svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
    .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // gray background
  vis.append("rect")
    .style("fill", "#ddd")
    .attr("width", width)
    .attr("height", height);

  // x axis ticks + vertical lines
  vis.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")") // at the bottom
    .call(xAxis);

  // y axis ticks + horizontal lines
  vis.append("g")
    .attr("class", "y axis")
    .call(yAxis);

  vis.selectAll(".line").remove();

  var rollingMeanWindow = parseInt(monitorSettings.rollingMeanWindow);
  // FIXME
  vis.append("svg:path")
    .attr("class", "line")
    .attr("fill", "none")
    .attr("stroke", "maroon")  // FIXME
    .attr("stroke-width", 1)
    .attr("d", d3.svg.line()
          .x(function(d) { return x(d._idx); }) // FIXME
          .y(function(d) { return y(d.foo); }) // FIXME
          .interpolate(movingAvg(rollingMeanWindow)));

  // FIXME
  if (rollingMeanWindow === 1) {
    vis.selectAll("circle.line")
      .data(monitorData)
    .enter().append("svg:circle")
      .attr("class", "line")
      .attr("fill", "maroon" )
      .attr("cx", function(d) { return x(d._idx); }) // FIXME
      .attr("cy", function(d) { return y(d.foo); }) // FIXME
      .attr("r", 2);
  }

  var focus = vis.append("g")
      .attr("class", "focus")
      .style("display", "none");

  var focusLine = vis.append("line")
        .attr("y1", y.range()[0])
        .attr("y2", y.range()[1])
        .style("stroke-width", 2)
        .style("stroke", "black")
        .style("opacity", 0.5)
        .style("fill", "none");

  focus.append("text")
      .attr("x", 9)
      .attr("dy", ".35em");

  vis.append("rect")
    .attr("class", "overlay")
    .attr("fill", "none")
    .attr("pointer-events", "all")
      .attr("width", width)
      .attr("height", height)
      .on("mouseover", function() { focus.style("display", null); })
      .on("mouseout", function() { focus.style("display", "none"); })
      .on("mousemove", mousemove);

  // FIXME use keyFn instead of ._idx
  function mousemove() {
    var x0 = x.invert(d3.mouse(this)[0]),
        bisector = d3.bisector(function(d) { return d._idx; }).left,
        // set minimum of 1
        i = bisector(monitorData, x0, 1, monitorData.length - 1),
        d0 = monitorData[i - 1],
        d1 = monitorData[i];
    // figure out which of the 2 surrounding points is closer
    var d;
    if (Math.abs(d0._idx - x0) > Math.abs(d1._idx - x0)) {
      d = d1;
    } else {
      d = d0;
    }
    // focus.attr("transform", "translate(" + x(d._idx) + "," + y(d.foo) + ")");
    // focus.attr("transform", "translate(" + d3.mouse(this)[0] + "," + d3.mouse(this)[1] + ")");

    // put focus on x location aligned with samples
    var focus_x = x(d._idx);
    // put focus on y at location of mouse
    var focus_y = d3.mouse(this)[1];

    focus.attr("transform", "translate(" + focus_x + "," + focus_y + ")");
    focusLine.attr("x1", focus_x).attr("x2", focus_x);
    // FIXME show only relevant keys
    focus.select("text").text(JSON.stringify(d));
  }

}

rivets.bind($('#settings'), {settings: monitorSettings});
loadMonitorData();
// })();
