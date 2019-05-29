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
        {title:"route<br>Name", field:"routeName", headerFilter:"input", headerTooltip:"routeName", width:100, headerSort:true, headerVertical:false, bottomCalc:routesTotal },
        {title:"Mapped %", field:"mapped%total", headerFilter:"input", headerTooltip:"mapped%total", width:50, headerSort:true, headerVertical:true, formatter:"progress", formatterParams: progressbar },

        // icon : jump to routeMap.html with URL params
        {title: "Map Route", formatter:routeMapperIcon, width:40, align:"center", headerVertical:true, cellClick:function(e, cell){
            let row = cell.getRow().getData();
            let jumpRoute = `${row['folder']}/${row['jsonFile']}`;
            var win = window.open(`routeMap.html?route=${jumpRoute}`, '_blank');
            win.focus();
        }},
        {title: "Edit Timings", formatter:clockIcon, width:40, align:"center", headerVertical:true, cellClick:function(e, cell){
            let row = cell.getRow().getData();
            let jumpRoute = `${row['folder']}/${row['jsonFile']}`;
            var win = window.open(`timings.html?route=${jumpRoute}`, '_blank');
            win.focus();
        }},
        {title:"Number<br>of Stops", field:"len", headerFilter:"input", headerTooltip:"number of stops (both directions)", width:55, headerSort:true,headerVertical:true },
        //{title:"trip times", field:"timings", headerTooltip:"if route has trips", width:50, headerSort:false, headerVertical:true, formatter:"tickCross", formatterParams:{crossElement:false} },
        {title:"Trip Times", field:"timings", headerTooltip:"if route has trips", width:50, headerSort:true, headerVertical:true, formatter:tickIcon },
        {title:"Frequency", field:"frequency", headerTooltip:"if route has frequency", width:50, headerSort:true, headerVertical:true,formatter:tickIcon },
        {title: "Edit Route", formatter:editIcon, width:40, align:"center", headerVertical:true, cellClick:function(e, cell){
            let row = cell.getRow().getData();
            let jumpRoute = `${row['folder']}/${row['jsonFile']}`;
            var win = window.open(`routeEntry.html?route=${jumpRoute}`, '_blank');
            win.focus();
        }},
        // {title:"avg confidence", field:"avgConfidence", headerFilter:"input", headerTooltip:"avg confidence", width:70, headerSort:true, headerVertical:true },
        // {title:"% autoMapped", field:"autoMapped%", headerFilter:"input", headerTooltip:"autoMapped%", width:70, headerSort:true, headerVertical:true, formatter:"progress", formatterParams: progressbar },
        //{title:"% manually", field:"manuallyMapped%", headerFilter:"input", headerTooltip:"manuallyMapped%", width:70, headerSort:true, headerVertical:true, formatter:"progress", formatterParams: progressbar },
        //{title:"hull", field:"hull", headerFilter:"input", headerTooltip:"higher number indicates there may be mis-mapped stops in the route", width:70, headerSort:true, headerVertical:true },
        //{title:"% onward", field:"mapped%0", headerFilter:"input", headerTooltip:"mapped%0", width:70, headerSort:true, headerVertical:true },
        //{title:"% return", field:"mapped%1", headerFilter:"input", headerTooltip:"mapped%1", width:70, headerSort:true, headerVertical:true },
        //{title:"bus Type", field:"busType", headerFilter:"input", headerTooltip:"busType", width:60, headerSort:true, headerVertical:true },
        // {title:"jsonFile", field:"jsonFile", headerFilter:"input", headerTooltip:"jsonFile", width:140, headerSort:true },
    ],
    rowSelected:function(row){ //when a row is selected
        let stuff = row.getData();
        drawLine(stuff['folder'],stuff['jsonFile']);
	}
});

// ########################
// LEAFLET MAP
var MBlight = L.tileLayer.provider('MapBox', {id: 'nikhilsheth.m0mmobne', accessToken: MBaccessToken });
var gStreets = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',{maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']});

var map = new L.Map('map', {
	center: STARTLOCATION,
	zoom: 10,
	layers: [gStreets],
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
    loadDefaults();
    loadRoutes();

    // ###########
    // Listeners for the checkboxes, to toggle columns on or off in tabulator table
    $('#autoMapped').on('change', e => {
        if(e.target.checked) {
            let col = {title:"% Auto-<br>Mapped", field:"autoMapped%", headerFilter:"input", headerTooltip:"autoMapped%", width:50, headerSort:true, headerVertical:true, formatter:"progress", formatterParams: progressbar };
            routes_tabulator.addColumn(col, false);
        } else {
            routes_tabulator.deleteColumn("autoMapped%"); // use the field, luke, use the field!
        }
    });

    $('#manuallyMapped').on('change', e => {
        if(e.target.checked) {
            let col = {title:"% Manually<br>Mapped", field:"manuallyMapped%", headerFilter:"input", headerTooltip:"manuallyMapped%", width:50, headerSort:true, headerVertical:true, formatter:"progress", formatterParams: progressbar };
            routes_tabulator.addColumn(col, false);
        } else {
            routes_tabulator.deleteColumn("manuallyMapped%"); // use the field, luke, use the field!
        }
    });

    $('#hull').on('change', e => {
        if(e.target.checked) {
            let col = {title:"Convex<br> &nbsp; Hull", field:"hull", headerFilter:"input", headerTooltip:"higher number indicates there may be mis-mapped stops in the route", width:50, headerSort:true, headerVertical:true };
            routes_tabulator.addColumn(col, false);
        } else {
            routes_tabulator.deleteColumn("hull"); // use the field, luke, use the field!
        }
    });

    $('#filename').on('change', e => {
        if(e.target.checked) {
            let col = {title:"filename", field:"jsonFile", headerFilter:"input", headerTooltip:"jsonFile", width:120, headerSort:true };
            routes_tabulator.addColumn(col, false);
        } else {
            routes_tabulator.deleteColumn("jsonFile"); // use the field, luke, use the field!
        }
    });

    $('#busType').on('change', e => {
        if(e.target.checked) {
            let col = {title:"Bus<br>Type", field:"busType", headerFilter:"input", headerTooltip:"busType", width:80, headerSort:true, headerVertical:false };
            routes_tabulator.addColumn(col, false);
        } else {
            routes_tabulator.deleteColumn("busType"); // use the field, luke, use the field!
        }
    });

    $('#onwardMapped').on('change', e => {
        if(e.target.checked) {
            let col = {title:"Onward %<br>Mapped", field:"mapped%0", headerFilter:"input", headerTooltip:"Onward journey % mapped", width:50, headerSort:true, headerVertical:true, formatter:"progress", formatterParams: progressbar };
            routes_tabulator.addColumn(col, false);
        } else {
            routes_tabulator.deleteColumn("mapped%0"); // use the field, luke, use the field!
        }
    });

    $('#returnMapped').on('change', e => {
        if(e.target.checked) {
            let col = {title:"Return %<br>Mapped", field:"mapped%1", headerFilter:"input", headerTooltip:"Return journey % mapped", width:50, headerSort:true, headerVertical:true, formatter:"progress", formatterParams: progressbar };
            routes_tabulator.addColumn(col, false);
        } else {
            routes_tabulator.deleteColumn("mapped%1"); // use the field, luke, use the field!
        }
    });


});


//#####################################
// API Call functions
function drawLine(folder,jsonFile,direction_id="0") {
    console.log("Fetching route:",folder,jsonFile,direction_id);
    $('#mapStatus').html('Loading..');
    lineLayer.clearLayers();
    // 28.5.19: Intervention: load the route's json directly instead of bothering the server.
    $.getJSON(`routes/${folder}/${jsonFile}`, function(data) {
        lineLayer.clearLayers(); // clear me baby one more time
        if(! Array.isArray(data[`stopsArray${direction_id}`])) {
            $('#mapStatus').html('No lat-longs available for this route.');
            return;
        }
        var collector = [];
        data[`stopsArray${direction_id}`].forEach(row => {
            let lat = parseFloat(row['stop_lat']);
            let lon = parseFloat(row['stop_lon']);
            if(checklatlng(lat,lon)) collector.push([lat,lon]);
        });
        var routeLine = L.polyline.antPath(collector, {color: 'red', weight:4, delay:1000, interactive:false }).addTo(lineLayer);
        if (!map.hasLayer(lineLayer)) map.addLayer(lineLayer);
        map.fitBounds(lineLayer.getBounds(), {padding:[0,0], maxZoom:15});
        $('#mapStatus').html(`Loaded ${folder} / ${jsonFile}<br>onward direction. <a href="routeMap.html?route=${folder}/${jsonFile}" target="_blank"><b>Click to Edit</b></a>`);

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
            routes_tabulator.setData(results.data);
            $('#status').html(`Loaded ${filename}.<br>
                <a href="reports/${filename}">Click to download</a>`);
        },
        error: function(err, file, inputElem, reason) {
                $('#status').html(`Could not load ${filename}, check reports folder.`);
        },
	});
}
