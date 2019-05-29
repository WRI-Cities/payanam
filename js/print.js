// print.js

// ######################################
/* GLOBAL VARIABLES */
var URLParams = {}; // for holding URL parameters
var globalRoute = '';

var baseLayer = [L.layerGroup(null), L.layerGroup(null)];
var stopsLayer = [L.geoJson(null), L.geoJson(null) ];
var lineLayer = [L.geoJson(null), L.geoJson(null) ];

// #################################
/* MAPs */
// background layers, using Leaflet-providers plugin. See https://github.com/leaflet-extras/leaflet-providers
var base = {
//"OSM": [ L.tileLayer.provider('OpenStreetMap.Mapnik') , L.tileLayer.provider('OpenStreetMap.Mapnik')],
"MBlight": [ L.tileLayer.provider('MapBox', {id: 'nikhilsheth.m0mmobne', accessToken: MBaccessToken }) , L.tileLayer.provider('MapBox', {id: 'nikhilsheth.m0mmobne', accessToken: MBaccessToken })],
"MBdark": [ L.tileLayer.provider('MapBox', {id: 'nikhilsheth.jme9hi44', accessToken: MBaccessToken }) , L.tileLayer.provider('MapBox', {id: 'nikhilsheth.jme9hi44', accessToken: MBaccessToken })],
"MBstreets": [ L.tileLayer.provider('MapBox', {id: 'nikhilsheth.m0mlpl2d', accessToken: MBaccessToken }) , L.tileLayer.provider('MapBox', {id: 'nikhilsheth.m0mlpl2d', accessToken: MBaccessToken })],
"MBsatlabel": [ L.tileLayer.provider('MapBox', {id: 'nikhilsheth.m0mmaa87', accessToken: MBaccessToken }) , L.tileLayer.provider('MapBox', {id: 'nikhilsheth.m0mmaa87', accessToken: MBaccessToken })],
"OSMIndia": [ L.tileLayer.provider('MapBox', {id: 'openstreetmap.1b68f018', accessToken: MBaccessToken }) , L.tileLayer.provider('MapBox', {id: 'openstreetmap.1b68f018', accessToken: MBaccessToken })],
"gStreets": [ L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',{maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']}) , L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',{maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']})],
"gHybrid": [ L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']}) , L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3']})],
"gSat": [ L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{maxZoom: 20,subdomains:['mt0','mt1','mt2','mt3']}) , L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{maxZoom: 20,subdomains:['mt0','mt1','mt2','mt3']})]
};
/*
var map = [
    new L.Map('map0', { layers: [base["MBlight"][0]], center: STARTLOCATION, zoom: STARTZOOM, scrollWheelZoom: true, maxZoom: 18, zoomControl: false, preferCanvas: true }),
    new L.Map('map1', { layers: [base["MBlight"][1]], center: STARTLOCATION, zoom: STARTZOOM, scrollWheelZoom: true, maxZoom: 18, zoomControl: false, preferCanvas: true }),
];
*/
var map = [null,null];
for(dir in [0,1]) {
    map[dir] = new L.Map(`map${dir}`, { layers: [base["MBlight"][dir]], center: STARTLOCATION, zoom: STARTZOOM, scrollWheelZoom: true, maxZoom: 18, zoomControl: false });
    baseLayer[dir].addTo(map[dir]);
    stopsLayer[dir].addTo(map[dir]);
    lineLayer[dir].addTo(map[dir]);
}
$('.leaflet-container').css('cursor','crosshair'); // from https://stackoverflow.com/a/28724847/4355695 Changing mouse cursor to crosshairs
// SVG renderer
var myRenderer = L.canvas({ padding: 0.5 });

// Leaflet.Control.Custom : add custom HTML elements
// see https://github.com/yigityuce/Leaflet.Control.Custom
/*
headerOptions = { position: 'bottomleft', content:`div class="mapHeader ${dir}" ` }
L.control.custom({
	position: 'bottomleft',
	content: `<select id="routeLineSelect"><option value="">Pick a route</option></select><br>
		<span id="routeLineStatus">Preview route</span> | <a href="javascript:;" onclick="jump2Mapper()">Edit</a>`,
	classes: 'divOnMap1'
}).addTo(map);
*/

// #####################################################################
// RUN ON PAGE LOAD

$(document).ready(function() {
	
	$.ajaxSetup({ cache: false }); // from https://stackoverflow.com/a/13679534/4355695 to force ajax to always load from source, don't use browser cache. This prevents browser from loading old route jsons.
    loadDefaults();
    loadJsonsList();

    $('#jsonSelect').on('change', function (e) {
		if( this.value == '') { 
			return;
		}
		globalRoute = this.value;
		console.log(globalRoute);
		loadJson();
    });
    
    // URL parameters. from https://stackoverflow.com/a/2405540/4355695
    var query = window.location.search.substring(1).split("&");
    for (var i = 0, max = query.length; i < max; i++)
    {
        if (query[i] === "") // check for trailing & with no param
            continue;
        var param = query[i].split("=");
        URLParams[decodeURIComponent(param[0])] = decodeURIComponent(param[1] || "");
        // this gets stored to global json variable URLParams
    }

    // check URLParams if a route is supposed to be loaded
    if(URLParams['route']) {
        console.log('Auto-loading route:',URLParams['route']);
        globalRoute = URLParams['route'];
        loadJson();
        $('#jsonSelect').val(globalRoute);
        $('#jsonSelect').trigger('chosen:updated');
    }

    $('#dims').on('change', function (e) {
        setDimensions(this.value);
    });

    bgChoices();

    $('#background').on('change', function (e) {
        console.log(this.value);
        var destination = this.value; // need to copy this over, as "this.value" doesn't make it to inside the next loop
        if( ! this.value) return;
        for(dir in [0,1]) {
            baseLayer[dir].clearLayers();
            base[destination][dir].addTo(baseLayer[dir]);
        }
    });

    /* // test markers
    var marker1 = L.marker([17.4963,78.42857]).addTo(stopsLayer[0]); marker1.bindTooltip('30c'); L.tooltipLayout.resetMarker(marker1);
    var marker2 = L.marker([17.47532,78.55641]).addTo(stopsLayer[0]); marker2.bindTooltip('35 ground'); L.tooltipLayout.resetMarker(marker2);
    var marker3 = L.marker([17.39174,78.51236]).addTo(stopsLayer[0]); marker3.bindTooltip('6 number'); L.tooltipLayout.resetMarker(marker3);
    var marker4 = L.marker([17.3918,78.51082]).addTo(stopsLayer[0]); marker4.bindTooltip('6 number'); L.tooltipLayout.resetMarker(marker4);
    var marker5 = L.marker([17.39164,78.51092]).addTo(stopsLayer[0]); marker5.bindTooltip('6 number'); L.tooltipLayout.resetMarker(marker5);
    var marker6 = L.marker([17.51731,78.51293]).addTo(stopsLayer[0]); marker6.bindTooltip('7 temples'); L.tooltipLayout.resetMarker(marker6);
    var marker7 = L.marker([17.32553,78.57151]).addTo(stopsLayer[0]); marker7.bindTooltip('8v x road'); L.tooltipLayout.resetMarker(marker7);
    var marker8 = L.marker([17.35577,78.43393]).addTo(stopsLayer[0]); marker8.bindTooltip('9 number x road'); L.tooltipLayout.resetMarker(marker8);
    var marker9 = L.marker([17.35656,78.43831]).addTo(stopsLayer[0]); marker9.bindTooltip('9 number x road'); L.tooltipLayout.resetMarker(marker9);
    var marker10 = L.marker([17.48543,78.38575]).addTo(stopsLayer[0]); marker10.bindTooltip('9th phase rtc'); L.tooltipLayout.resetMarker(marker10);
    var marker11 = L.marker([17.44416,78.433]).addTo(stopsLayer[0]); marker11.bindTooltip('a g colony x road'); L.tooltipLayout.resetMarker(marker11);
    var marker12 = L.marker([17.45299,78.59078]).addTo(stopsLayer[0]); marker12.bindTooltip('a-type'); L.tooltipLayout.resetMarker(marker12);
    var marker13 = L.marker([17.46854,78.5652]).addTo(stopsLayer[0]); marker13.bindTooltip('a. p. s. r. t. c kushaiguda depot'); L.tooltipLayout.resetMarker(marker13);
    var marker14 = L.marker([17.47436,78.51717]).addTo(stopsLayer[0]); marker14.bindTooltip('a.o.c.'); L.tooltipLayout.resetMarker(marker14);
    
    L.tooltipLayout.initialize(map0, null);
    */
   

});

//#####################################
// API Call functions
function loadJsonsList() {
    $.get( `${APIpath}loadJsonsList`, function( data ) {
        console.log('GET request loadJsonsList successful.');
        $('#jsonSelect').html(data);
        $('#jsonSelect').trigger('chosen:updated'); 
        $('#jsonSelect').chosen({disable_search_threshold: 1, search_contains:true, width:200, placeholder_text_single:'Pick a route'});
	});
}

// ############################################
// JS FUNCTIONS

function loadJson() {
	if(globalRoute == '') return;

	// clearEverything(loaderText='loading...');
	console.log('loadJson():',globalRoute)

	$.getJSON(`routes/${globalRoute}`, function(data) {
        console.log(data);
        // gotta render!
        [0,1].forEach(function(dir,n) {
            stopsLayer[dir].clearLayers();
            var stopsArray = data[`stopsArray${dir}`] || [];

            mappedList = stopsArray.filter(a => ! isNaN(parseFloat(a.stop_lat)));
            console.log(mappedList);
            
            lineCollector = [];
            mappedList.forEach(function(stoprow,i) {
                let lat = parseFloat(stoprow['stop_lat']);
                let lon = parseFloat(stoprow['stop_lon']);
                
                if( ! checklatlng(lat,lon) ) {
                    console.log('Skipping a stop because of invalid values:', stopsjson[stoprow]);
                    return;
                }
                lineCollector.push([lat,lon]);
                var tooltipContent = `${i}: ${stoprow.stop_name}`;
                var tooltipOptions = {permanent:false, direction:'right', offset:[20,0] };
                var stopmarker = L.marker([lat,lon], { 
                    icon: L.divIcon({
                        className: `stop-divicon`,
                        iconSize: [25, 25],
                        html: ( parseInt(i)+1 )
                    }) 
                })
                .bindTooltip(tooltipContent,tooltipOptions);
                stopmarker.properties = stoprow;
                stopmarker.addTo(stopsLayer[dir]);
                map[dir].fitBounds(stopsLayer[dir].getBounds(), {padding:[20,20], maxZoom:15});
            }); // end of mappedList loop

            var polyOptions = { color:'blue' };
            var poly = L.polyline(lineCollector, polyOptions).addTo(lineLayer[dir]);
            
            var spacer = Array(5).join(" "); // repeater. from https://stackoverflow.com/a/1877479/4355695
            // putting arrows. See https://github.com/makinacorpus/Leaflet.TextPath
            poly.setText(spacer+'►'+spacer, {repeat: true, offset: 7, attributes: {'font-weight': 'bold', 'font-size': '24', 'fill':'blue'}})

        }); // end of 0,1 direction loop

        // L.tooltipLayout.initialize(map0, null);
    }); // end of getJSON
}

function bgChoices() {
    var content = '';
    Object.entries(base).forEach(
        ([key, value]) => {
            if( key == 'MBlight')
                content += `<option selected>${key}</option>`;
            else content += `<option>${key}</option>`;
        }
    );
    $('#background').html(content);
}

function setDimensions(value) {
    var dims = value.split('x');
    var h = parseInt(dims[1]);
    var w = parseInt(dims[0]);
    $('.map').css('height',`${h}px`);
    $('.map').css('width',`${w}px`);
    // there, that resizes the map.
    // to do: zoom/pan to fit the route if a route is loaded.
}

function downloadURI( img, name) {
	var link = document.createElement("a");
	link.download = name;
	link.href = `data:${img}`;
	link.click();
	link.remove();
}


function printMap() {
    //Render internally as image here itself so that even without saving as image, the image is ready for sending to backend server.
    // https://html2canvas.hertzen.com/getting-started
    // https://stackoverflow.com/a/33669243/4355695 but syntax of the trigger function updated.
    html2canvas(document.querySelector('.page'),{ useCORS: true}).then(function(canvas) {
        var img = canvas.toDataURL("image/png");
        downloadURI(img, 'test.png');
    });
}

function changeColor() {
    var color = $("#color").val();
    var fontColor = $("#fontColor").val();
    lineLayer[0].setStyle( {color:color} );
    lineLayer[1].setStyle( {color:color} );
    $('.stop-divicon').css('background-color',color);
    $('.stop-divicon').css('color',fontColor);
    // re-do setText for arrows
    var spacer = Array(5).join(" "); // repeater. from https://stackoverflow.com/a/1877479/4355695
    lineLayer[0].setText(spacer+'►'+spacer, {repeat: true, offset: 7, attributes: {'font-weight': 'bold', 'font-size': '24', 'fill':color}})
    lineLayer[1].setText(spacer+'►'+spacer, {repeat: true, offset: 7, attributes: {'font-weight': 'bold', 'font-size': '24', 'fill':color}})

}