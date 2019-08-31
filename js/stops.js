// stops.js
// started 4.8.19

// ######################################
/* 1. GLOBAL VARIABLES */
var depotsLayer = new L.geoJson(null); // for depots

var stopsLayer = new L.layerGroup();

var firstRunDone = false; // for preventing 3-time calling of mapStops() on startup.

// ######################################
// TABULATOR
// first, define custom functions that will be called by the table
var stopsTotal = function(values, data, calcParams){
	var calc = values.length;
	return calc + ' stops total';
}
const table_height = 400;
var stopsTable = new Tabulator("#stops", {
	height: table_height,
    selectable:1,
    selectableRollingSelection:true,
	//movableRows: true, //enable user movable rows
	//movableColumns: true, //enable user movable columns
	//layout:"fitColumns", //fit columns to width of table (optional)
	index: "sr", 
	layout:"fitDataFill",
	//addRowPos: "top",
	tooltipsHeader:true, //enable header tooltips
	columns:[ //Define Table Columns
		// stop_id,stop_name,stop_lat,stop_lon,zone_id,wheelchair_boarding
		//{rowHandle:true, formatter:"handle", headerSort:false, frozen:true, width:30, minWidth:30},
		//{title:"Num", width:40, formatter: "rownum", frozen:true }, // row numbering
		{title:"sr", field:"sr", frozen:false, width:30, headerVertical:true },
		{title:"stop_name", field:"stop_name", headerFilter:"input", bottomCalc:stopsTotal, width:200 },
		{title:"count", field:"count", headerFilter:"input", width:30, headerVertical:true },
		{title:"routes", field:"num_routes", headerFilter:"input", width:30, headerVertical:true },
		{title:"depots", field:"num_depots", headerFilter:"input", width:30, headerVertical:true }
	],
	dataLoaded: function(data) {
        if(!data.length) return;
        setTimeout(function() { mapStops(firstRun=true); },500); // load the map but after an interval
    },
    dataFiltered:function(filters, rows){
		if(rows.length) { 
			setTimeout(mapStops,500);
		}
    },
    rowSelected:function(row){ //when a row is selected
        var r = row.getData();
		var lat = parseFloat(r.stop_lat);
        var lon = parseFloat(r.stop_lon);
        var content = `<p>Stop name: ${r.stop_name.split(', ').join(' / ')}<br>
        Location: ${r.stop_lat},${r.stop_lon} <small><a href="javascript:;" onclick="mapZoomHere(${lat},${lon})">locate</a></small><br>
        Present under ${r.num_routes} routes, ${r.num_depots} depots.<br>
        <small>Routes: ${r.routes}</small>`;
        $('#stopDetails').html(content);
        mapZoomHere(lat,lon); 
    },
    rowDeselected:function(row){ //when a row is selected
		$('#stopDetails').html('');
	},
});

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
	layers: [cartoVoyager],
	scrollWheelZoom: true,
	maxZoom: 20
});

var sidebar = L.control.sidebar('sidebar').addTo(map);

$('.leaflet-container').css('cursor','crosshair'); // from https://stackoverflow.com/a/28724847/4355695 Changing mouse cursor to crosshairs

L.control.scale({metric:true, imperial:false}).addTo(map);

// SVG renderer
var myRenderer = L.canvas({ padding: 0.5 });

var overlays = {
	"Stops": stopsLayer,
	"Depots": depotsLayer
};

var layerControl = L.control.layers(baseLayers, overlays, {collapsed: true, autoZIndex:false}).addTo(map); 

// Add in a crosshair for the map. From https://gis.stackexchange.com/a/90230/44746
var crosshairIcon = L.icon({
    iconUrl: crosshairPath,
    iconSize:     [crosshairSize, crosshairSize], // size of the icon
    iconAnchor:   [crosshairSize/2, crosshairSize/2], // point of the icon which will correspond to marker's location
});
crosshair = new L.marker(map.getCenter(), {icon: crosshairIcon, interactive:false});
crosshair.addTo(map);
// Move the crosshair to the center of the map when the user pans
map.on('move', function(e) {
    crosshair.setLatLng(map.getCenter());
});

// lat, long in url
var hash = new L.Hash(map);

// ######################################
// RUN ON PAGE LOAD

$(document).ready(function() {
    loadDefaults();
    // load depots
	loadDepots();
	loadStops();
	setTimeout(function () {
		sidebar.open('home');
	}, 2000);

    // redraw tabulator table on window resize, from http://tabulator.info/docs/4.3/layout#redraw
    window.addEventListener('resize', function(){
        stopsTable.redraw(true);
    });
});

// ######################################
// FUNCTIONS

function loadStops() {
    filename = 'reports/locations_all.csv';
    Papa.parse(`${filename}?_=${(new Date).getTime()}`, {
        download: true,
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false, // this reads numbers as numerical; set false to read everything as string
        complete: function(results, file) {
            stopsTable.setData(results.data);
        }
    });
}

function mapStops(firstRun=false) {
    if(firstRun) firstRunDone = true; // only dataloaded callback sends firstRun as true

	if(!firstRunDone) {
		if(debugMode) console.log('mapStops called but firstRunDone flag not set yet.');
		return;
	}
    stopsLayer.clearLayers();
    var data = stopsTable.getData(true);
    var mappedList = data.filter(a => ! isNaN(parseFloat(a.stop_lat)));
	// .filter() : from https://medium.com/poka-techblog/simplify-your-javascript-use-map-reduce-and-filter-bd02c593cc2d
    // and figured out a way to detect if a variable is a number and not null or undefined or blank or string
    
    for (i = 0; i < mappedList.length; i++) {
		stoprow = mappedList[i];
		
		let lat = parseFloat(stoprow['stop_lat']);
		let lon = parseFloat(stoprow['stop_lon']);
		
		if( ! checklatlng(lat,lon) ) {
			console.log('Skipping a stop because of invalid values:', stopsjson[stoprow]);
			continue;
		}

		var circleMarkerOptions = {
			renderer: myRenderer,
			radius: 3 + 1.5 * Math.log(parseInt(stoprow.num_routes)),
			//radius: 3 + (parseInt(stoprow.num_routes))/5,
			fillColor: 'lightblue',
			color: 'black',
			weight: 0.5,
			opacity: 1,
			fillOpacity: 0.4
		};
		var tooltipContent = `${stoprow.stop_name}`;
		//if(stoprow.stop_sequence) tooltipContent = `${stoprow.stop_sequence}:${tooltipContent}`; // prefix sequence
		
		var stopmarker = L.circleMarker([lat,lon], circleMarkerOptions).bindTooltip(tooltipContent, {direction:'right', offset:[10,0]});
        stopmarker.properties = stoprow;
        stopmarker.on('click',function(e) {
            if(e.target.properties) {
                let sr = e.target.properties.sr;
                stopsTable.deselectRow();
                stopsTable.selectRow(sr);
                stopsTable.scrollToRow(sr, "top", false);
                
            }
        });
		stopmarker.addTo(stopsLayer);
    }
    if(! map.hasLayer(stopsLayer)) map.addLayer(stopsLayer);

}
function mapZoomHere(lat,lon,zoom=15) {
	if( ! checklatlng(lat,lon) ) {
		console.log('mapZoomHere(): invalid lat-lon values:', lat,lon);
		return;
    }
    zoom = map.getZoom() < zoom ? zoom : map.getZoom();
	map.flyTo([lat,lon], zoom, {/*duration:1,*/ animate:true});

}

function tabulatorRedraw() {
    // redraw tabulator table on window resize, from http://tabulator.info/docs/4.3/layout#redraw
    console.log('clicked!');
    setTimeout(function() { stopsTable.redraw(); },1000);
}
