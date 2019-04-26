/* routesOverview.js
*/

// ######################################
/* 1. GLOBAL VARIABLES */
const routes_height = "500px";

var lineLayer = new L.geoJson(null);

// #################################
/* 2. Initiate tabulators */

// first, define custom functions that will be called by the 
var routesTotal = function(values, data, calcParams){
	var calc = values.length;
	return calc + ' routes total';
}

var progressbar = {
    min:0,
    max:100,
    color:["#ffff66", "lightblue"],
    legend: true,
    legendColor:"black",
    legendAlign:"center",
};

//custom formatter definition : moved to common.js
/*
var printIcon = function(cell, formatterParams, onRendered){ //plain text value
    return `<img src="lib/route.svg" height="20" width="20">`;
};
*/

var routes_tabulator = new Tabulator("#routes", {
    height: routes_height,
    selectable:1,
    layout:"fitDataFill",
    //responsiveLayout:"collapse",
	addRowPos: "top",
	tooltipsHeader:true,
    columns:[
        {title:"sr", field:"sr", headerFilter:"input", headerTooltip:"serial number", width:15, headerSort:true, frozen:true },
        {title:"depot", field:"depot", headerFilter:"input", headerTooltip:"depot", width:75, headerSort:true },
        {title:"jsonFile", field:"jsonFile", headerFilter:"input", headerTooltip:"jsonFile", width:140, headerSort:true, bottomCalc:routesTotal },
        {title:"% mapped total", field:"mapped%total", headerFilter:"input", headerTooltip:"mapped%total", width:70, headerSort:true, headerVertical:true, formatter:"progress", formatterParams: progressbar },
        {title:"avg confidence", field:"avgConfidence", headerFilter:"input", headerTooltip:"avg confidence", width:70, headerSort:true, headerVertical:true },
        {title:"% autoMapped", field:"autoMapped%", headerFilter:"input", headerTooltip:"autoMapped%", width:70, headerSort:true, headerVertical:true, formatter:"progress", formatterParams: progressbar },
        {title:"% manually", field:"manuallyMapped%", headerFilter:"input", headerTooltip:"manuallyMapped%", width:70, headerSort:true, headerVertical:true, formatter:"progress", formatterParams: progressbar },
        {title:"hull", field:"hull", headerFilter:"input", headerTooltip:"higher number indicates there may be mis-mapped stops in the route", width:70, headerSort:true, headerVertical:true },
        // icon : jump to routeMap.html with URL params
        {title: "map", formatter:printIcon, width:40, align:"center", cellClick:function(e, cell){
            let row = cell.getRow().getData();
            let jumpRoute = `${row['folder']}/${row['jsonFile']}`;
            var win = window.open(`routeMap.html?route=${jumpRoute}`, '_blank');
            win.focus();
        }},
        {title:"len", field:"len", headerFilter:"input", headerTooltip:"number of stops (both directions)", width:50, headerSort:true },
        {title:"timings", field:"timings", headerFilter:"input", headerTooltip:"if route has trips ", width:50, headerSort:false, formatter:"tickCross", formatterParams:{crossElement:false} },
        {title:"freq", field:"frequency", headerFilter:"input", headerTooltip:"if route has frequency", width:50, headerSort:false,formatter:"tickCross", formatterParams:{crossElement:false} },

        //{title:"% onward", field:"mapped%0", headerFilter:"input", headerTooltip:"mapped%0", width:70, headerSort:true, headerVertical:true },
        //{title:"% return", field:"mapped%1", headerFilter:"input", headerTooltip:"mapped%1", width:70, headerSort:true, headerVertical:true },
        {title:"route Name", field:"routeName", headerFilter:"input", headerTooltip:"routeName", width:100, headerSort:true, headerVertical:true },
        {title:"bus Type", field:"busType", headerFilter:"input", headerTooltip:"busType", width:60, headerSort:true, headerVertical:true },
    ],
    rowSelected:function(row){ //when a row is selected
        let stuff = row.getData();
        drawLine(stuff['folder'],stuff['jsonFile']);
	}
});

// ########################
// LEAFLET MAP
var MBlight = L.tileLayer.provider('MapBox', {id: 'nikhilsheth.m0mmobne', accessToken: MBaccessToken });
var map = new L.Map('map', {
	center: STARTLOCATION,
	zoom: 10,
	layers: [MBlight],
	scrollWheelZoom: true,
    maxZoom: 20
});

$('.leaflet-container').css('cursor','crosshair'); // from https://stackoverflow.com/a/28724847/4355695 Changing mouse cursor to crosshairs
// SVG renderer
var myRenderer = L.canvas({ padding: 0.5 });
map.addControl(new L.Control.Fullscreen({position:'topright'}));

L.easyButton('<img src="lib/zoom-out.svg" width="100%" title="zoom to fit" data-toggle="tooltip" data-placement="right">', function(btn, map){
    if( lineLayer.getLayers().length )
		map.fitBounds(lineLayer.getBounds(), {padding:[0,0], maxZoom:15});
}).addTo(map);

// Leaflet.Control.Custom : add custom HTML elements
// see https://github.com/yigityuce/Leaflet.Control.Custom
L.control.custom({
	position: 'bottomleft',
	content: `<div id="mapStatus">Click on a route to preview it.</div>`,
	classes: 'divOnMap1'
}).addTo(map);


// ########################
// RUN ON PAGE LOAD
$(document).ready(function() {
    loadRoutes();
});


//#####################################
// API Call functions
function drawLine(folder,jsonFile,direction_id="0") {
    console.log("Fetching route:",folder,jsonFile,direction_id);
    $('#mapStatus').html('Loading..');
    lineLayer.clearLayers();
	$.getJSON(`${APIpath}getRouteLine?folder=${folder}&jsonFile=${jsonFile}&direction_id=${direction_id}`, function(data) {
        if(!data.length) {
            $('#mapStatus').html('No lat-longs available for this route.');
            return;
        }
        var routeLine = L.polyline.antPath(data, {color: 'red', weight:4, delay:1000, interactive:false }).addTo(lineLayer);
        if (!map.hasLayer(lineLayer)) map.addLayer(lineLayer);
        map.fitBounds(lineLayer.getBounds(), {padding:[0,0], maxZoom:15});
        $('#mapStatus').html(`Loaded ${folder} / ${jsonFile}<br>onward direction. <a href="routeMap.html?route=${folder}/${jsonFile}" target="_blank"><b>Click to Edit</b></a>`)
	}).fail(function(err) {
        $('#mapStatus').html('No lat-longs available for this route.');
    });
}

// ############################################
// JS FUNCTIONS
function loadRoutes(which='progress') {
    $('#status').html(`Loading..`);
    var filename = '';
    if(which == 'all') filename = 'routes.csv';
    if(which == 'progress') filename = 'routes_inprogress.csv';
    if(which == 'locked') filename = 'routes_locked.csv';

	Papa.parse(`reports/${filename}?_=${(new Date).getTime()}`, {
        // a "cache buster" to force always load from disk instead of cache, from https://stackoverflow.com/a/48883260/4355695
		download: true,
		header: true,
		skipEmptyLines: true,
		complete: function(results, file) {
            // Intervention: pre-process, check for timings and just put true/false like flags for tript times and frequency
            results.data.forEach(row => {
                timeFlag = false
                freqFlag = false
                // checks
                if (row.hasOwnProperty('t0.trip_times')) { if(row['t0.trip_times'].length > 2) timeFlag = true; }
                if (row.hasOwnProperty('t1.trip_times')) { if(row['t1.trip_times'].length > 2) timeFlag = true; }

                if (row.hasOwnProperty('t0.frequency')) { if(parseInt(row['t0.frequency']) > 0) freqFlag = true; }
                if (row.hasOwnProperty('t1.frequency')) { if(parseInt(row['t1.frequency']) > 0) freqFlag = true; }

                row['timings']=timeFlag;
                row['frequency']=freqFlag;
            });
            console.log(results.data);
            routes_tabulator.setData(results.data);
            $('#status').html(`Loaded ${filename}.<br>
                <a href="reports/${filename}">Click to download</a>`);
        },
        error: function(err, file, inputElem, reason) {
                $('#status').html(`Could not load ${filename}, check reports folder.`);
        },
	});
}
