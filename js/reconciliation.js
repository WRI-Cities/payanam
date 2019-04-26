/* mappedStops.js */


// ######################################
/* 1. GLOBAL VARIABLES */
const stopsTable_height = "400px";
const uniqueStopsTable_height = "300px";

const normalColor = "blue";
const selectedColor = "yellow"

var tableData = [];
var chosenStops = [];

// leaflet layers - need them global so all function can add to and remove from them.
var stopsLayer = new L.geoJson(null);
var depotsLayer = new L.geoJson(null); // for depots
var lineLayer = new L.geoJson(null);
var allMappedLayer = new L.geoJson(null);
// #################################
/* 2. Initiate tabulators */


// first, define custom functions that will be called by the table
var stopsTotal = function(values, data, calcParams){
	var calc = values.length;
	return calc + ' stops total';
}

var namesTotal = function(values, data, calcParams){
	var calc = values.length;
	return calc + ' unique names total';
}

//########################
// now the actual table construction
var uniqueStopsTable = new Tabulator("#uniqueStopsTable", {
	height:uniqueStopsTable_height,
    selectable:true,
    layout:"fitDataFill",
	addRowPos: "top",
	tooltipsHeader:true,
	index: "sr",
	columns:[ //Define Table Columns
        {title:"sr", field:"sr", headerFilter:"input", headerTooltip:"sr", width:15, headerSort:true },
        //{title:"zap", field:"zap", headerFilter:"input", headerTooltip:"zap", width:150, headerSort:true },
        {title:"stop_name", field:"stop_name", headerFilter:"input", headerTooltip:"stop_name", width:150, headerSort:true, bottomCalc:namesTotal },
        {title:"locs", field:"num_locations", headerFilter:"input", headerTooltip:"num_locations", width:70, headerSort:true },
        {title:"count", field:"count", headerFilter:"input", headerTooltip:"count", width:70, headerSort:true },
        {title:"hull", field:"hull", headerFilter:"input", headerTooltip:"hull", width:70, headerSort:true },
        {title:"routes", field:"routes", headerFilter:"input", headerTooltip:"routes", width:100, headerSort:true },
        {title:"num", field:"num_routes", headerFilter:"input", headerTooltip:"num_routes", width:70, headerSort:true },
        {title:"depots", field:"depots", headerFilter:"input", headerTooltip:"depots", width:100, headerSort:true },
        {title:"num", field:"num_depots", headerFilter:"input", headerTooltip:"num_depots", width:70, headerSort:true },
		/*
		{title:"direction_id", field:"direction_id", headerFilter:"input", headerTooltip:"direction_id", width:50, headerSort:false },
        {title:"stop_sequence", field:"stop_sequence", headerFilter:"input", headerTooltip:"stop_sequence", width:50, headerSort:false },
        {title:"stop_lon", field:"stop_lon", headerFilter:"input", headerTooltip:"stop_lon", width:50, headerSort:false },
		{title:"confidence", field:"confidence", headerFilter:"input", headerTooltip:"confidence", width:50, headerSort:false }
		*/
	],
	rowClick:function(e, row){
		filterStops();

		// other things to clear out:
		lineLayer.clearLayers();
	}

});

var stopsTable = new Tabulator("#stopsTable", {
	height:stopsTable_height,
    selectable:true,
    layout:"fitDataFill",
	addRowPos: "top",
	tooltipsHeader:true,
	index: "sr",
    columns:[ //Define Table Columns
		{title:"sr", field:"sr", headerFilter:"input", headerTooltip:"sr", width:15, headerSort:false },
		//{title:"zap", field:"zap", headerFilter:"input", headerTooltip:"zap", width:150, headerSort:true },
        {title:"stop_name", field:"stop_name", headerFilter:"input", headerTooltip:"stop_name", width:120, headerSort:false, bottomCalc:stopsTotal },
        {title:"jsonFile", field:"jsonFile", headerFilter:"input", headerTooltip:"jsonFile", width:80, headerSort:false },
        {title:"depot", field:"depot", headerFilter:"input", headerTooltip:"depot", width:50, headerSort:false },
		{title:"direction_id", field:"direction_id", headerFilter:"input", headerTooltip:"direction_id", width:50, headerSort:false },
		/* nooooo too much power!!
		{title: "map", formatter:printIcon, width:40, align:"center", cellClick:function(e, cell){
            let row = cell.getRow().getData();
			drawLine(row.folder,row.jsonFile,row.direction_id);
			// let jumpRoute = `${row['folder']}/${row['jsonFile']}`;
            // var win = window.open(`routeMap.html?route=${jumpRoute}`, '_blank');
            // win.focus();
        }}, */
        {title:"stop_lat", field:"stop_lat", headerFilter:"input", headerTooltip:"stop_lat", width:70, headerSort:true },
        {title:"stop_lon", field:"stop_lon", headerFilter:"input", headerTooltip:"stop_lon", width:70, headerSort:true },
        {title:"confidence", field:"confidence", headerFilter:"input", headerTooltip:"confidence", width:50, headerSort:true },
        {title:"stop_sequence", field:"stop_sequence", headerFilter:"input", headerTooltip:"stop_sequence", width:50, headerSort:false }
	],
	rowSelected:function(row){ //when a row is selected
		colorMap(row.getData().sr,selectedColor);
	},
	rowDeselected:function(row){
		colorMap(row.getData().sr,normalColor);
	},
	rowClick:function(e, row){
		let data = row.getData();
		let lat = parseFloat( data.stop_lat );
		let lng = parseFloat( data.stop_lon );
		if (lat && lng)
			map.panTo([lat,lng]);
	},
	rowContext:function(e, row){
		e.preventDefault(); // prevent the browsers default context menu form appearing.
		console.log('Right-click capture!');
    },
});


// #################################
/* 3. Initiate map */
// background layers, using Leaflet-providers plugin. See https://github.com/leaflet-extras/leaflet-providers
var OSM = L.tileLayer.provider('OpenStreetMap.Mapnik');
var MBlight = L.tileLayer.provider('MapBox', {id: 'nikhilsheth.m0mmobne', accessToken: MBaccessToken });
var MBdark = L.tileLayer.provider('MapBox', {id: 'nikhilsheth.jme9hi44', accessToken: MBaccessToken });
var MBstreets = L.tileLayer.provider('MapBox', {id: 'nikhilsheth.m0mlpl2d', accessToken: MBaccessToken });
var MBsatlabel = L.tileLayer.provider('MapBox', {id: 'nikhilsheth.m0mmaa87', accessToken: MBaccessToken });
var OSMIndia = L.tileLayer.provider('MapBox', {id: 'openstreetmap.1b68f018', accessToken: MBaccessToken });
var gStreets = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',{maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']});
var gHybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']});
var baseLayers = { "OpenStreetMap.org" : OSM, "OpenStreetMap.IN": OSMIndia, "Streets": MBstreets, "Satellite": MBsatlabel, "Light": MBlight, "Dark" : MBdark, "gStreets": gStreets, "gHybrid": gHybrid };

var map = new L.Map('map', {
	center: STARTLOCATION,
	zoom: STARTZOOM,
	layers: [MBlight],
	scrollWheelZoom: true,
	maxZoom: 20
});

$('.leaflet-container').css('cursor','crosshair'); // from https://stackoverflow.com/a/28724847/4355695 Changing mouse cursor to crosshairs

L.control.scale({metric:true, imperial:false}).addTo(map);

// SVG renderer
var myRenderer = L.canvas({ padding: 0.5 });

// Marker for positioning new stop or changing location of stop
var dragmarkerOptions = {
	//renderer: myRenderer,
	radius: 5,
	fillColor: "red",
	color: null,
	weight: 1,
	opacity: 1,
	fillOpacity: 0.8,
	interactive: false
};
var dragmarker = L.circleMarker(null, dragmarkerOptions);
//layerControl.addOverlay(dragmarker , "Marker");

var overlays = {
	"Mapped Stops": stopsLayer,
	"depots": depotsLayer,
	"Mapillary Photos": mapillaryLayer,
	"Marker" : dragmarker,
	"Route Line": lineLayer,
	"All Mapped Stops": allMappedLayer
};

var layerControl = L.control.layers(baseLayers, overlays, {collapsed: true, autoZIndex:false}).addTo(map); 

// https://github.com/Leaflet/Leaflet.fullscreen
map.addControl(new L.Control.Fullscreen({position:'topright'}));

const lasso = L.lasso(map); // lasso tool : https://github.com/zakjan/leaflet-lasso

// buttons on map
L.easyButton('<img src="lib/lasso.jpg" width="100%" title="Click to activate Lasso tool: Press mouse button down and drag to draw a lasso on the map around the points you want to select." data-toggle="tooltip" data-placement="right">', function(btn, map){
	lasso.enable();
}).addTo(map);

L.easyButton('<img src="lib/zoom-out.svg" width="100%" title="zoom to see all stops in top table" data-toggle="tooltip" data-placement="right">', function(btn, map){
	// if( stopsTable.getDataCount(true) )
	if( stopsLayer.getLayers().length )
		map.fitBounds(stopsLayer.getBounds(), {padding:[20,20], maxZoom:15});
}).addTo(map);


// Leaflet.Control.Custom : add custom HTML elements
// see https://github.com/yigityuce/Leaflet.Control.Custom
L.control.custom({
	position: 'bottomleft',
	content: `<select id="routeLineSelect"><option value="">Pick a route</option></select><br>
		Preview route | <a href="javascript:;" onclick="jump2Mapper()">Edit</a>`,
	classes: 'divOnMap1'
}).addTo(map);

L.control.custom({
	position: 'bottomright',
	content: `<a onclick="openMapillary()" href="javascript:;">fetch nearby Mapillary pics</a><br>
		<span id="mapillaryStatus"></span>`,
	classes: 'divOnMap2'
}).addTo(map);

L.control.custom({
	position: 'bottomright',
	content: `<a onclick="toggleLayer()" href="javascript:;">toggle All Mapped stops</a>`,
	classes: 'divOnMap2'
}).addTo(map);




// #####################################################################
// RUN ON PAGE LOAD

$(document).ready(function() {
	
	$.ajaxSetup({ cache: false }); // from https://stackoverflow.com/a/13679534/4355695 to force ajax to always load from source, don't use browser cache. This prevents browser from loading old route jsons.
	
	loadUniqueStops();
	loadStops(which='mapped',first=true);

	$(window).resize(function(){
		stopsTable.redraw();
	});

	// load depots
	loadDepots();

	map.on('lasso.finished', (event) => {
		console.log(`${event.layers.length} stops selected by lasso tool`);
		event.layers.forEach(element => {
			if(element.properties) {
				stopsTable.selectRow(element.properties.sr);
			}
			// note: take care to ensure that this only takes stops from stopsLayer. By default it grabs whatever's there, irrespective of layer. Currently, this entails that no other layer should have feature.properties set.
		});
	});

	map.on('lasso.disabled', (event) => {
		// lasso was making mouse cursor into hand after completion. So make it crosshairs again
		$('.leaflet-container').css('cursor','crosshair');
		// from https://stackoverflow.com/a/28724847/4355695 Changing mouse cursor to crosshairs
	});

	map.on('click', function(e) {
		map.panTo(e.latlng);
		dragmarker.setLatLng(e.latlng);
		if (!map.hasLayer(dragmarker)) map.addLayer(dragmarker);
		let lat = Math.round(e.latlng.lat*100000)/100000;
		let lon = Math.round(e.latlng.lng*100000)/100000;
		$("#recon_loc").val(`${lat},${lon}`);
	});

	$('#routeLineSelect').on('change', function (e) {
		let holder = this.value;
		if(!holder.length) {
			lineLayer.clearLayers(); // clear out the presently loaded stuff
			return;
		}
		let parts = holder.split('|');
		drawLine(parts[0],parts[1],parts[2]);
	
	});

	$('#chooseMode').on('change', function (e) {
		console.log(this.value);
		resetEverything();
		loadUniqueStops(this.value);
		loadStops(this.value);
	});
});



// ############################################
// JS FUNCTIONS

function loadUniqueStops(which='mapped') {
	// var filename = 'stops_mapped_unique.csv';
	var filename = `stops_${which}_unique.csv`;
	uniqueStopsTable.clearData();

	Papa.parse(`reports/${filename}?_=${(new Date).getTime()}`, {
		download: true,
		header: true,
		skipEmptyLines: true,
		dynamicTyping: true, // this reads numbers as numerical; set false to read everything as string
		complete: function(results, file) {
			uniqueStopsTable.setData(results.data);
            //$('#status').html(``);
		},
		error: function(err, file, inputElem, reason) {
            console.log(`${filename} not found. please run reports generation script once.`);
        }
	});
}

function loadStops(which='mapped',first=false) {
    $('#status').html(`Loading..`);
    // var filename = 'stops_mapped.csv';
    var filename = `stops_${which}.csv`;
	stopsTable.clearData();

	Papa.parse(`reports/${filename}?_=${(new Date).getTime()}`, {
		download: true,
		header: true,
		skipEmptyLines: true,
		complete: function(results, file) {
			stopsTable.setData(results.data);
			$('#status').html(``);
			
			// extra: if called on page load, then store everything in an all-stops layer
			if(first) {
				//allMappedLayer
				setTimeout(function(){ mapStops(false); }, 2000); 
			}
		},
		error: function(err, file, inputElem, reason) {
            console.log(`${filename} not found. please run reports generation script once.`);
        }
	});
}

function mapStops(normal=true) {
	tableData = stopsTable.getData(true);
	console.log('Displaying',tableData.length,'stops on map.'); 
	// confirm if filter is working

	if(normal) stopsLayer.clearLayers();
	else allMappedLayer.clearLayers();

	for (i = 0; i < tableData.length; i++) {
		let stoprow = tableData[i];

		let lat = parseFloat(stoprow['stop_lat']);
		let lon = parseFloat(stoprow['stop_lon']);
		
		if( ! checklatlng(lat,lon) ) {
			console.log('Skipping a stop because of invalid values:', stoprow);
			continue;
		}

		var circleMarkerOptions = {
			renderer: myRenderer,
			radius: normal ? 5 : 3,
			// fillColor: directionDecide(stoprow),
			fillColor: normal ? 'blue' : 'orange',
			color: 'black',
			weight: 0.5,
			opacity: normal? 1 : 0,
			fillOpacity: 0.5
		};

		var automappedFlag = '';
		console.log('confidence:',stoprow.confidence)
		if( normal && stoprow.confidence == '0') automappedFlag = '&nbsp;&nbsp;(automapped)';
		var tooltipContent = `${stoprow.sr}:${stoprow.depot}/${stoprow.routeName}${automappedFlag}<br>${stoprow.stop_name}`;
		var stopmarker = L.circleMarker([lat,lon], circleMarkerOptions).bindTooltip(tooltipContent);
		if(normal) stopmarker.properties = stoprow; // doing this to prevent the lasso tool from selecting from the allMappedLayer
		
		if(normal) stopmarker.on('click',markerOnClick);
		
		if(normal) stopmarker.addTo(stopsLayer);
		else stopmarker.addTo(allMappedLayer);

	}
	if (normal && !map.hasLayer(stopsLayer)) map.addLayer(stopsLayer);

}

function filterStops() {
	var selectedUniques = uniqueStopsTable.getSelectedData();
	if(!selectedUniques.length) return;

	$('#uniqueSelectStatus').html(selectedUniques.length);
	names = []

	// 5.4.19 : Changing matching by stop_name to matching by 'zap'.
	selectedUniques.forEach(element => {
		names.push(element.zap);
	});
	//names = ['Tanda','Kondapur'];
	console.log(names);

	// constructing filter array for Tabulator. the sibling items in this array are in OR relationship with each other.
	filterArray = [];
	names.forEach(element => {
		filterArray.push({ field:"zap", type:"=", value:element });
	});
	
	stopsTable.setFilter([filterArray]);
	mapStops();
}

function colorMap(sr,chosenColor) {
	stopsLayer.eachLayer( function(layer) {
		if(layer.properties && (layer.properties.sr == sr) ) {
			layer.setStyle({
				fillColor : chosenColor,
				fillOpacity : 1.0
			});
			if(chosenColor == selectedColor) layer.bringToFront();
			else layer.bringToBack();
		}
	});
	countSelectedStops();
}

function markerOnClick(e) {
	// when a stop is clicked on map, select and show it in the table.
	if(e.target.properties) {
		sr = e.target.properties.sr;
		stopsTable.selectRow(sr);
		stopsTable.scrollToRow(sr, "center", false);
	}
}

function clearSelections(which="unique") {
	if(which == "unique") {
		uniqueStopsTable.deselectRow();
		$("#uniqueSelectStatus").html("0");
	} else {
		stopsTable.deselectRow();
	}
	$("#recon_stop_name").val(""); // reset the reconciled stop name as we're moving to next work item
	$("#recon_stop_desc").val(""); 
	$("#recon_loc").val(""); 
}


function countSelectedStops() {
	let data = stopsTable.getSelectedData();
	$(".stopSelectStatus").html(data.length );
	let content = '';
	let routeSelectOptions  = ['<option value="">Pick a route</option>'];

	data.forEach(element => {
		content += `${element.depot}/${element.jsonFile}: dir ${element.direction_id}: ${element.stop_name}\n`;
		
		let dropDownTitle = `${element.depot}|${element.jsonFile}|${element.direction_id}`;
		// routeSelectOptions += `<option value="${dropDownTitle}|">${dropDownTitle}</option>`;
		routeSelectOptions.push(`<option value="${dropDownTitle}|">${dropDownTitle}</option>`);
	});
	$("#reconcillationPreview").val(content);

	// get rid of duplicates for routeSelectOptions
	// from https://stackoverflow.com/a/14438954/4355695 , 
	var uniqueRouteSelectOptions = routeSelectOptions.filter((v, i, a) => a.indexOf(v) === i); 
	$('#routeLineSelect').html(uniqueRouteSelectOptions);
	lineLayer.clearLayers();

	/* lets not mess with the lat-longs, can lead to disasters
	if(data.length) {
		$("#recon_loc").val(`${data[0].stop_lat},${data[0].stop_lon}`);
		if(! $("#recon_stop_name").val().length) $("#recon_stop_name").val(data[0].stop_name);
	} else {
		// $("#recon_stop_name").val(''); // hey keep the name
		$("#recon_loc").val('');
	}
	*/

}

function stopsSelectAll() {
	// doing this because the default way seems to be getting into unnecessary loops/processing.
	var rows = stopsTable.getRows(true);
	rows.forEach(element => {
		element.select();
	});
}

function reconcileSubmit() {
	// globalApiKey
	var data = {};
	data['recon_stop_name'] = $("#recon_stop_name").val();
	data['recon_stop_desc'] = $("#recon_stop_desc").val();
	let loc = $("#recon_loc").val().split(',');
	data['recon_stop_lat'] = parseFloat(loc[0]);
	data['recon_stop_lon'] = parseFloat(loc[1]);
	data['stops'] = stopsTable.getSelectedData();
	console.log("reconcileSubmit(): Sending this data package:");
	console.log(JSON.stringify(data,null,2));

	// check for blanks
	if(!data['recon_stop_name'].length || !data['recon_stop_lat'] || !data['recon_stop_lon'] || data['stops'].length < 1 ) {
		$('#reconcileStatus').html('<p class="alert alert-danger">All data not present; Please make sure everything is properly filled out before proceeding.</p>');
		return;
	}

	$('#reconcileStatus').html('Reconciling...');

	$.ajax({
		url : `${APIpath}reconcile?key=${globalApiKey}`,
		type : 'POST',
		data : JSON.stringify(data),
		cache: false,
		processData: false,  // tell jQuery not to process the data
		contentType: false,  // tell jQuery not to set contentType
		success : function(returndata) {
			console.log('Successfully sent data via POST to server /API/reconcile, response received: ' + returndata);
			$('#reconcileStatus').html(`<p class="alert alert-success">${returndata}</p>`);
		},
		error: function(jqXHR, exception) {
			console.log( jqXHR.responseText );
			$('#reconcileStatus').html(`<span class="alert alert-danger">${jqXHR.responseText}</span>`);
		}
	});

}

function resetEverything() {
	clearSelections("stops");
	stopsTable.clearFilter(true);
	clearSelections();
	uniqueStopsTable.clearFilter(true);
	$('#reconcileStatus').html("");
	stopsLayer.clearLayers();
	lineLayer.clearLayers();
	mapillaryLayer.clearLayers();
	
	MBlight.addTo(map);
	map.flyTo(STARTLOCATION,STARTZOOM);
}

function drawLine(folder,jsonFile,direction_id) {
	console.log("Fetching route:",folder,jsonFile,direction_id);
	lineLayer.clearLayers();
	$.getJSON(`${APIpath}getRouteLine?folder=${folder}&jsonFile=${jsonFile}&direction_id=${direction_id}`, function(data) {
		var routeLine = L.polyline.antPath(data, {color: stopOnwardColor, weight:3, delay:1000, interactive:false }).addTo(lineLayer);
		if (!map.hasLayer(lineLayer)) map.addLayer(lineLayer);
		console.log("Fetched route:",folder,jsonFile,direction_id);
	});
}

function jump2Mapper() {
	let code = $('#routeLineSelect').val();
	if(!code.length) return;
	let parts = code.split('|');
	let jumpRoute = `${parts[0]}/${parts[1]}`;
	console.log('jump2Mapper:',jumpRoute);
	// open in new window - copied from routes overview page's js
	var win = window.open(`routeMap.html?route=${jumpRoute}`, '_blank');
	win.focus();
}

function pickFirst(what='location') {
	let data = stopsTable.getSelectedData();
	if(!data.length) return;

	if(what == 'location') {
		let lat = data[0]['stop_lat'];
		let lon = data[0]['stop_lon'];
		if(lat && lon)
			$("#recon_loc").val(`${lat},${lon}`);
	} else {
		$("#recon_stop_name").val(data[0]['stop_name']);
	}
}

function toggleLayer(which="allMapped") {
	if(which == "allMapped")
		if (!map.hasLayer(allMappedLayer)) map.addLayer(allMappedLayer);
		else map.removeLayer(allMappedLayer);
}
