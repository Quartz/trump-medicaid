// NPM modules
var d3 = require('d3');
var geo = require('d3-geo-projection');
var topojson = require('topojson');
var _ = require('lodash');

// Local modules
var features = require('./detectFeatures')();
var fm = require('./fm');
var utils = require('./utils');
var geomath = require('./geomath');

// Globals
var MOBILE_BREAKPOINT = 600;
var SIMPLE_LABELS = [{
    'lat': 0,
    'lng': 0,
    'label': 'My label',
    'class': ''
}];

// Map configurations
var configure = require('./maps/usa-counties.js');

// Global vars
var isMobile = false;
var topoData = {};
var fipsData = {};
var identityProjection = null;


/**
 * Initialize the graphic.
 *
 * Fetch data, format data, cache HTML references, etc.
 */
function init() {
    // Used for computing centroids in coordinate space
    identityProjection = d3.geo.path()
        .projection({stream: function(d) { return d; }});

	d3.json('data/geodata.json', function(error, data) {
        // Extract topojson features
        for (var key in data['objects']) {
            topoData[key] = topojson.feature(data, data['objects'][key]);
        }

        d3.csv('data/data.csv', function(error, data) {
            _.each(data, function(d) {
                fipsData[d['fips']] = d;
            })

            render();
            $(window).resize(utils.throttle(onResize, 250));
        });
    });
}

/**
 * Invoke on resize. By default simply rerenders the graphic.
 */
function onResize() {
	render();
}

/**
 * Figure out the current frame size and render the graphic.
 */
function render() {
	var containerWidth = $('#interactive-content').width();

    if (!containerWidth) {
        containerWidth = DEFAULT_WIDTH;
    }

    if (containerWidth <= MOBILE_BREAKPOINT) {
        isMobile = true;
    } else {
        isMobile = false;
    }

    // What kind of map are we making?
    var configuration = configure(containerWidth);

    // Render the map!
    renderMap(configuration, {
        container: '#graphic',
        width: containerWidth,
        data: topoData
    });

    // Resize
    fm.resize();
}

var renderMap = function(typeConfig, instanceConfig) {
    /*
     * Setup
     */
    var topMargin = 0;

    // Calculate actual map dimensions
    var mapWidth = instanceConfig['width'];
    var mapHeight = Math.ceil(instanceConfig['width'] / typeConfig['aspect_ratio']) + topMargin;

    // Clear existing graphic (for redraw)
    var containerElement = d3.select(instanceConfig['container']);
    containerElement.html('');

    /*
     * Create the map projection.
     */
    var centroid = typeConfig['centroid'];
    var mapScale = mapWidth * typeConfig['scale_factor'];

    var projection = typeConfig['projection']
        .scale(mapScale)
        .translate([mapWidth / 2, mapHeight / 2]);

    var path = d3.geo.path()
        .projection(projection)
        .pointRadius(typeConfig['dot_radius'] * mapScale);

    /*
     * Create the root SVG element.
     */
    var chartWrapper = containerElement.append('div')
        .attr('class', 'graphic-wrapper');

    var chartElement = chartWrapper.append('svg')
        .attr('width', mapWidth)
        .attr('height', mapHeight);

    var mapElement = chartElement.append('g')
        .attr('transform', 'translate(0, ' + topMargin + ')')

    /*
     * Render paths.
     */
    var pathsElement = mapElement.append('g')
        .attr('class', 'paths');

    function classifyFeature(d) {
        var c = [];

        if (d['id']) {
            c.push(utils.classify(d['id']));
        }

        for (var property in d['properties']) {
            var value = d['properties'][property];

            c.push(utils.classify(property + '-' + value));
        }

        return c.join(' ');
    }

    pathsElement.append('g')
        .attr('class', 'counties')
        .selectAll('path')
            .data(instanceConfig['data']['counties']['features'])
        .enter().append('path')
            .attr('d', path)
            .attr('class', function(d) {
                var data = fipsData[parseInt(d['id'])];

                if (!data) {
                    return 'nodata';
                }

                if (!data['eligible']) {
                    return 'nodata';
                }

                var trumpScale = 'low';
                var eligibleScale = 'low';

                if (data['trump_pct'] >= 71.88933) {
                    trumpScale = 'high';
                } else if (data['trump_pct'] >= 58.53041) {
                    trumpScale = 'mid';
                }

                if (data['eligible'] >= 22.770) {
                    eligibleScale = 'high';
                } else if (data['eligible'] >= 15.581) {
                    eligibleScale = 'mid';
                }

                return (trumpScale + '_' + eligibleScale);
            });

    pathsElement.append('g')
        .attr('class', 'states')
        .selectAll('path')
            .data(instanceConfig['data']['states']['features'])
        .enter().append('path')
            .attr('d', path)
            .attr('class', classifyFeature);

    // var legendElement = chartElement.append('g')
    //     .attr('class', 'legend')
    //     .attr('transform', utils.makeTranslate(mapWidth * 0.65, mapHeight * 0.18));
    //
    // var side = mapWidth * 0.025;
    //
    // _.each(['low', 'mid', 'high'], function(x, i) {
    //     _.each(['low', 'mid', 'high'], function(y, j) {
    //         legendElement.append('rect')
    //             .attr('class', x + '_' + y)
    //             .attr('x', side * i)
    //             .attr('y', -side * j)
    //             .attr('width', side)
    //             .attr('height', side);
    //     });
    // });
    //
    // legendElement.append('text')
    //     .attr('transform', 'translate(' + 0 + ',' + (side * 1.5) + ')')
    //     .text('Trump vote →')
    //
    // legendElement.append('text')
    //     .attr('transform', 'translate(' + (side * 3.5) + ',' + side + ') rotate(270)')
    //     .text('Medicaid eligiblity →')
    //
    // chartElement.append('text')
    //     .attr('class', 'title')
    //     .attr('x', mapWidth * 0.2)
    //     .attr('y', mapHeight * 0.1)
    //     .text('Medicaid cuts will hit Trump supporters hardest')

    /*
     * Render labels.
     */
    // var labelsElement = chartElement.append('g')
    //     .attr('class', 'labels');
    //
    // function renderLabels(group) {
    //     labelsElement.append('g')
    //         .attr('class', group)
    //         .selectAll('text')
    //             .data(instanceConfig['data'][group]['features'])
    //         .enter().append('text')
    //             .attr('class', classifyFeature)
    //             .attr('transform', function(d) {
    //                 var point = null;
    //
    //                 if (d['geometry']['type'] == 'Point') {
    //                     // Note: copy by value to prevent insanity
    //                     point = d['geometry']['coordinates'].slice();
    //                 } else {
    //                     point = identityProjection.centroid(d);
    //                 }
    //
    //                 if (group in typeConfig['label_nudges']) {
    //                     var nudge = typeConfig['label_nudges'][group][d['id']];
    //
    //                     if (nudge === undefined) {
    //                         nudge = typeConfig['label_nudges'][group]['default'];
    //                     }
    //
    //                     if (nudge !== undefined) {
    //                         point[0] += nudge[0];
    //                         point[1] += nudge[1];
    //                     }
    //                 }
    //
    //                 return 'translate(' + projection(point) + ')';
    //             })
    //             .text(function(d) {
    //                 if (group in typeConfig['label_subs']) {
    //                     var sub = typeConfig['label_subs'][group][d['id']];
    //
    //                     if (sub !== undefined) {
    //                         return sub;
    //                     }
    //                 }
    //
    //                 return d['id']
    //             });
    // }
    //
    // for (var layer in typeConfig['labels']) {
    //     renderLabels(typeConfig['labels'][layer]);
    // }
    //
    // labelsElement.append('g')
    //     .attr('class', 'simple')
    //     .selectAll('text')
    //         .data(SIMPLE_LABELS)
    //     .enter().append('text')
    //         .attr('class', function(d) {
    //             return d['class'];
    //         })
    //         .attr('transform', function(d) {
    //             return 'translate(' + projection([d['lng'], d['lat']]) + ')';
    //         })
    //         .text(function(d) {
    //             return d['label'];
    //         });

    /*
     * Render a scale bar.
     */
    // if (typeConfig['scale_bar_distance']) {
    //     var scaleBarDistance = typeConfig['scale_bar_distance'];
    //     var scaleBarStart = [10, mapHeight - 35];
    //     var scaleBarEnd = geomath.calculateScaleBarEndPoint(projection, scaleBarStart, scaleBarDistance);
    //
    //     chartElement.append('g')
    //         .attr('class', 'scale-bar')
    //         .append('line')
    //         .attr('x1', scaleBarStart[0])
    //         .attr('y1', scaleBarStart[1])
    //         .attr('x2', scaleBarEnd[0])
    //         .attr('y2', scaleBarEnd[1]);
    //
    //     var label = ' mile';
    //
    //     if (scaleBarDistance != 1) {
    //         label += 's';
    //     }
    //
    //     d3.select('.scale-bar')
    //         .append('text')
    //         .attr('x', scaleBarEnd[0] + 5)
    //         .attr('y', scaleBarEnd[1])
    //         .text(scaleBarDistance + label);
    // }

    /*
     * Reposition footer.
     */
    d3.selectAll('.footer')
        .style('top', (mapHeight - 10) + 'px')
}

// Bind on-load handler
$(document).ready(function() {
	init();
});