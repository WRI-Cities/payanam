// allMap.js
// Started on 8.4.19

// ######################################
/* 1. GLOBAL VARIABLES */
const shapesFolder = 'reports/shapes/';
// globalRandon : defined in common.js

// cycling through colors, see phrogzColors[] array in commonjs
var globalColorNum = 0;
var globalColorJson = {};
// colors sourced from http://phrogz.net/css/distinct-colors.html

// leaflet layers - need them global so all function can add to and remove from them.
var depotsLayer = new L.geoJson(null); // for depots

var lineLayer = new L.layerGroup();
// https://github.com/calvinmetcalf/leaflet-ajax, saw on https://gis.stackexchange.com/a/102125/44746
// var lineLayer = new L.GeoJSON.AJAX(null);

// ######################################
// Initiate Leaflet MAP
// background layers, using Leaflet-providers plugin. See https://github.com/leaflet-extras/leaflet-providers
var OSM = L.tileLayer.provider('OpenStreetMap.Mapnik');
var cartoVoyager = L.tileLayer.provider('CartoDB.VoyagerLabelsUnder');
var cartoPositron = L.tileLayer.provider('CartoDB.Positron');
var cartoDark = L.tileLayer.provider('CartoDB.DarkMatter');
var esriWorld = L.tileLayer.provider('Esri.WorldImagery');
var gStreets = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',{maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']});
var gHybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']});

var baseLayers = { "CartoDB Voyager":cartoVoyager, "OpenStreetMap.org" : OSM, "CartoDB Light": cartoPositron, "CartoDB Dark": cartoDark, "ESRI Satellite": esriWorld, "gStreets": gStreets, "gHybrid": gHybrid };

var map = new L.Map('map', {
	center: STARTLOCATION,
	zoom: 10,
	layers: [cartoPositron],
	scrollWheelZoom: true,
	maxZoom: 20
});

var sidebar = L.control.sidebar('sidebar').addTo(map);

$('.leaflet-container').css('cursor','crosshair'); // from https://stackoverflow.com/a/28724847/4355695 Changing mouse cursor to crosshairs

L.control.scale({metric:true, imperial:false}).addTo(map);

// SVG renderer
var myRenderer = L.canvas({ padding: 0.5 });

var overlays = {
	"Routes": lineLayer,
	"Depots": depotsLayer
};

var layerControl = L.control.layers(baseLayers, overlays, {collapsed: true, autoZIndex:false}).addTo(map); 

// ######################################
// RUN ON PAGE LOAD

$(document).ready(function() {
    loadDefaults();
    // load depots
	loadDepots();
	loadRoutes();
	setTimeout(function () {
		sidebar.open('home');
	}, 2000);

});


// ######################################
// FUNCTIONS
function loadRoutes() {
    var filename = `routes.csv`;
    $('#status').html(`Loading..`);
    Papa.parse(`reports/${filename}?_=${(new Date).getTime()}`, {
		download: true,
		header: true,
		skipEmptyLines: true,
		dynamicTyping: true, // this reads numbers as numerical; set false to read everything as string
		complete: function(results, file) {
            //process this into the simTree template format
            depotsList = [];
            simTreeData = [];
            //for(let i=0; i<results.data.length; i++)

            results.data.forEach(r => {

                var percent = '';
                if( parseFloat(r['mapped%total']) > 99.99) 
                    percent = `<small>(${r['mapped%total']}%)</small>`;
                else 
                    percent = `<small><b>(${r['mapped%total']}%)</b></small>`;

                row = {
                    "id": `${r.folder}|${r.jsonFile}`,
                    "pid": r.folder,
                    "name": `${r.routeName} ${percent}`,
                    "jsonFile": r.jsonFile
                };
                simTreeData.push(row);
               
                // if depot/folder is not added yet, add it as a parent node.
                if(!depotsList.includes(r.folder)) {
                    simTreeData.push({
                        "id": r.folder,
                        "pid": "",
                        "name": r.folder
                    });
                    // oh and remember to update depotsList
                    depotsList.push(r.folder);
                }

                // assign a color to each id value
                globalColorJson[row['id']] = phrogzColors[globalColorNum];
                globalColorNum ++;
                if(globalColorNum >= phrogzColors.length) globalColorNum = 0;
            });
            
            console.log("Constructed simTreeData, length: ",simTreeData.length);
            console.log("Colors:",JSON.stringify(globalColorJson));
            //console.log(simTreeData);
            // now, lauch simTree:
            simTree({
                el: '#tree',
                check: true,
                linkParent: true,
                data: simTreeData,
                onClick: function (item) {
                    //console.log(item);
                },
                onChange: function (item) {
                    //console.log(item);
                    mapRoutes(item);
                }
            });

            $('#status').html(`<small>All routes loaded.</small>`);
        }, // end of complete
        error: function(err, file, inputElem, reason) {
            $('#status').html(`Could not load ${filename}, check reports folder.`);
        },
	});
}

function mapRoutes(item) {
    //console.log(item);
    var fullDepots = [];
    var partialDepots = {};

    item.forEach(r => {
        if(r.pid == ''){
            fullDepots.push(r.id);
        } else {
            if(fullDepots.includes(r.pid)) return;
            if(partialDepots.hasOwnProperty(r.pid)) partialDepots[r.pid].push(r.jsonFile);
            else partialDepots[r.pid] = [r.jsonFile];
        }
    });
    console.log("fullDepots:",fullDepots);
    console.log("routes:",JSON.stringify(partialDepots));

    // cool, now load fullDepots first and then routes
    lineLayer.clearLayers();

    fullDepots.forEach(folder => {
        $.getJSON(`${shapesFolder}${folder}.geojson?random=${globalRandom}`, function(data) {
            data.features.forEach(tripFeature => {
                L.geoJSON(tripFeature, {
                    onEachFeature: onEachFeature,
                    style: styleFunc
                }).addTo(lineLayer);
            });

        }).fail(function(err) {
            console.log(err.responseText);
        });
    });
    
    
    $.each(partialDepots, function(folder, jsonsList) {
        console.log(folder, jsonsList);
        $.getJSON(`${shapesFolder}${folder}.geojson?random=${globalRandom}`, function(data) {
            data.features.forEach(tripFeature => {
                L.geoJSON(tripFeature, {
                    onEachFeature: onEachFeature,
                    style: styleFunc,
                    filter: function(feature, layer) {
                        return jsonsList.includes(feature.properties.jsonFile);
                    }
                }).addTo(lineLayer);
            });

        }).fail(function(err) {
            console.log(err.responseText);
        });

    });
    
    if(!map.hasLayer(lineLayer)) lineLayer.addTo(map);
}

function onEachFeature(feature, layer) {
    // does this feature have a property named popupContent?
    if (feature.properties && feature.properties.jsonFile) {
        layer.bindTooltip(`${feature.properties.folder}/${feature.properties.jsonFile}|${feature.properties.direction_id}`,{sticky:true});
        layer.bindPopup(`${feature.properties.folder}/${feature.properties.jsonFile}|${feature.properties.direction_id}<br><a href="routeMap.html?route=${feature.properties.folder}/${feature.properties.jsonFile}" target="_blank">Edit</a>`);
    }
}

function styleFunc(feature) {
    return {
        renderer: myRenderer,
        color: globalColorJson[`${feature.properties.folder}|${feature.properties.jsonFile}`],
        opacity: 0.5,
        weight: 4
    };
}
