// print.js

// ######################################
/* GLOBAL VARIABLES */
const stopIconSize = [20, 20];
var URLParams = {}; // for holding URL parameters
var globalRoute = '';

var baseLayer = [L.layerGroup(null), L.layerGroup(null)];
var stopsLayer = [L.geoJson(null), L.geoJson(null) ];
var lineLayer = [L.geoJson(null), L.geoJson(null) ];

var globalLineCollector = [];
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
"gSat": [ L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{maxZoom: 20,subdomains:['mt0','mt1','mt2','mt3']}) , L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{maxZoom: 20,subdomains:['mt0','mt1','mt2','mt3']})],


"Stamen Toner": [ L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}{r}.{ext}', {attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', subdomains: 'abcd',	minZoom: 0,	maxZoom: 20, ext: 'png'}) ],
"Stamen Toner-Lite": [ L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}{r}.{ext}', {attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', subdomains: 'abcd',	minZoom: 0,	maxZoom: 20, ext: 'png'}) ],
"Stamen Watercolor": [ L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}{r}.{ext}', {attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', subdomains: 'abcd',	minZoom: 0,	maxZoom: 20, ext: 'png'}) ],
"Stamen Terrain": [ L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.{ext}', {attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', subdomains: 'abcd',	minZoom: 0,	maxZoom: 20, ext: 'png'}) ],

"CartoDB Positron": [L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { 	attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>', 	subdomains: 'abcd', 	maxZoom: 19 })],

// fun layers!
"MB Run": [ L.tileLayer.provider('MapBox', {id: 'nikhilsheth.m0mmicn2', accessToken: MBaccessToken }) ],
"MB B+W": [ L.tileLayer.provider('MapBox', {id: 'nikhilsheth.m0mn13df', accessToken: MBaccessToken }) ],
"MB Pencil": [ L.tileLayer.provider('MapBox', {id: 'nikhilsheth.m0mn5lf5', accessToken: MBaccessToken }) ],
"MB Pirates": [ L.tileLayer.provider('MapBox', {id: 'nikhilsheth.m0mn8b72', accessToken: MBaccessToken }) ],
"MB Wheatpaste": [ L.tileLayer.provider('MapBox', {id: 'nikhilsheth.m0mnld61', accessToken: MBaccessToken }) ],
"MB Comic": [ L.tileLayer.provider('MapBox', {id: 'nikhilsheth.m0mo16hg', accessToken: MBaccessToken }) ]

};

/*
var map = [
    new L.Map('map0', { layers: [base["MBlight"][0]], center: STARTLOCATION, zoom: STARTZOOM, scrollWheelZoom: true, maxZoom: 18, zoomControl: false, preferCanvas: true }),
    new L.Map('map1', { layers: [base["MBlight"][1]], center: STARTLOCATION, zoom: STARTZOOM, scrollWheelZoom: true, maxZoom: 18, zoomControl: false, preferCanvas: true }),
];
*/
var map = [null,null];
for(dir in [0]) {
    map[dir] = new L.Map(`map${dir}`, { layers: [base["MBlight"][dir]], center: STARTLOCATION, zoom: STARTZOOM, scrollWheelZoom: true, maxZoom: 18, zoomControl: false, zoomDelta: 0.1, zoomSnap:0.1 });
    L.control.scale({position: 'bottomleft'}).addTo(map[dir])
    L.control.zoom({position: 'bottomleft'}).addTo(map[dir]);
    baseLayer[dir].addTo(map[dir]);
    stopsLayer[dir].addTo(map[dir]);
    lineLayer[dir].addTo(map[dir]);
}
$('.leaflet-container').css('cursor','crosshair'); // from https://stackoverflow.com/a/28724847/4355695 Changing mouse cursor to crosshairs
// SVG renderer
var myRenderer = L.canvas({ padding: 0.5 });

// Leaflet.Control.Custom : add custom HTML elements
// see https://github.com/yigityuce/Leaflet.Control.Custom
L.control.custom({
	position: 'topright',
    content: `
    <h4><span id="routeInfo"><small><small>Click "Options" and pick a route</small></small></span></h4>

    <div class="collapse hide" id="collapse_settings">
    <p>Select a route: <select id="jsonSelect"></select></p>
    <p>Change page dimensions:<br>
    Width:<input id="width" size="5" value="1000" type="number" min="100" max="10000" step="10">px, 
    Height:<input id="height" size="5" value="1450" type="number" min="100" max="10000" step="10">px<br>
    Map part:<input id="ratio" size="5" value="69" type="number" min="20" max="100" step="1">% &nbsp;&nbsp;
    <button onclick="changeDimensions()">Apply</button>
    &nbsp; | &nbsp; 
    <a onclick="changeDimensions(true)" href="javascript:;">Reset</a></p>

    <!--Presets: <a>A4</a> | <a>A3</a> | <a>A2</a> | <a>A1</a>-->
    </p>
    <p>Change background: <select id="background"></select> </p>
    <p>Change color: <input id="color" value="black" size="8">, font:<input id="fontColor" value="white" size="8">  <button onclick="changeColor()">Apply</button></p>

    </div>
    <div style="float:left;" class="no-print"><a data-toggle="collapse" href="#collapse_settings" role="button" aria-expanded="false" aria-controls="collapse_settings">>> Options</a></div>
    <div style="float:right;" class="no-print">
    <a onclick="zoomFit()" href="javascript:;">Fit map to Route</a> | 
    <a onclick="window.print()" href="javascript:;">Print</a>
    </div>
  `,
	classes: 'divOnMap1'
}).addTo(map[0]);

L.control.custom({
    position: 'topleft',
    content: `<span id="fromTo"></span>`,
    classes: 'divOnMap1'
}).addTo(map[0]);

/*
headerOptions = { position: 'bottomleft', content:`div class="mapHeader ${dir}" ` }

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
    }

    /*$('#dims').on('change', function (e) {
        setDimensions(this.value);
    });*/

    bgChoices();

    $('#background').on('change', function (e) {
        console.log(this.value);
        var destination = this.value; // need to copy this over, as "this.value" doesn't make it to inside the next loop
        if( ! this.value) return;
        for(dir in [0]) {
            baseLayer[dir].clearLayers();
            base[destination][dir].addTo(baseLayer[dir]);
        }
    });


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
    console.log('loadJson():',globalRoute);


	$.getJSON(`routes/${globalRoute}`, function(data) {
        // console.log(data);
        // gotta render!
        $('#jsonSelect').val(globalRoute);
        $('#jsonSelect').trigger('chosen:updated');
        let depot = globalRoute.split('/')[0];
        $('#routeInfo').html(`Depot: ${depot} | Route: ${data.routeName}`);
        // change page title
        document.title = `Depot ${depot}, Route ${data.routeName}`;

        [0].forEach(function(dir,n) {
            stopsLayer[dir].clearLayers();
            var stopsArray = data[`stopsArray${dir}`] || [];

            mappedList = stopsArray.filter(a => ! isNaN(parseFloat(a.stop_lat)));
            // filters down to mapped stops only
            // console.log(mappedList);
            
            globalLineCollector = []; // this is a global variable now
            var listHTML = '';
            var fromStop = '', toStop = '';
            mappedList.forEach(function(stoprow,i) {
                if(i==0) fromStop = stoprow.stop_name;
                if(i+1 == mappedList.length) toStop = stoprow.stop_name;

                let lat = parseFloat(stoprow['stop_lat']);
                let lon = parseFloat(stoprow['stop_lon']);
                
                if( ! checklatlng(lat,lon) ) {
                    console.log('Skipping a stop because of invalid values:', stopsjson[stoprow]);
                    return;
                }
                globalLineCollector.push([lat,lon]);
                listHTML += `<li>${i+1}. ${stoprow.stop_name}</li>`; // populate stops list
                var tooltipContent = `${i+1}: ${stoprow.stop_name}`;
                var tooltipOptions = {permanent:false, direction:'right', offset:[20,0] };
                var stopmarker = L.marker([lat,lon], { 
                    icon: L.divIcon({
                        className: `stop-divicon`,
                        iconSize: stopIconSize,
                        html: ( parseInt(i)+1 )
                    }) 
                })
                .bindTooltip(tooltipContent,tooltipOptions);
                stopmarker.properties = stoprow;
                stopmarker.addTo(stopsLayer[dir]);
                map[dir].fitBounds(stopsLayer[dir].getBounds(), {padding:[20,20], maxZoom:15});

            }); // end of mappedList loop

            drawLine();
            //console.log(listHTML);
            $(`#stopsList${dir}`).html(listHTML);
            $(`#fromTo`).html(`<h5 align="center">${fromStop}<br>to<br>${toStop}</h5>`);
        }); // end of 0,1 direction loop
        
        if(data['serviceNumbers']) if(data['serviceNumbers'].length) $(`.service`).html(`Service numbers: ${data['serviceNumbers'].join(', ')}`); // show service numbers if present.

        // L.tooltipLayout.initialize(map0, null); // feature discarded 
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

function changeDimensions(reset=false) {

    var w = parseInt($('#width').val());
    var h = parseInt($('#height').val());
    var ratio = parseFloat($('#ratio').val());

    if(reset) {
        w = 1000; $('#width').val(w);
        h = 1450; $('#height').val(h);
        ratio = 69; $('#ratio').val(ratio);
    }

    $('.page').css('width',`${w}px`);
    
    let mapH = parseInt( (h*ratio/100).toFixed(0));
    let stopsH = h - mapH;
    $('.map').css('height',`${mapH}px`);
    $('.stopsPart').css('height',`${stopsH}px`);
    console.log(w,h,mapH,stopsH);

    // there, that resizes the map.

        map[0].invalidateSize();
        // from https://stackoverflow.com/questions/24412325/resizing-a-leaflet-map-on-container-resize 
        //Checks if the map container size changed and updates the map if so — call it after you've changed the map size dynamically
        
        map[0].fitBounds(stopsLayer[0].getBounds(), {padding:[5,5], maxZoom:17});
        console.log(stopsLayer[0].getBounds());
    
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
    //lineLayer[1].setStyle( {color:color} );
    $('.stop-divicon').css('background-color',color);
    $('.stop-divicon').css('color',fontColor);
    // re-do setText for arrows
    drawLine(color);
    /*
    var spacer = Array(3).join(" "); // repeater. from https://stackoverflow.com/a/1877479/4355695
    lineLayer[0].setText(spacer+'>'+spacer, {repeat: true, offset: 6, attributes: {'font-weight': 'bold', 'font-size': '18', 'fill':color}}) // ►
    */

}

function drawLine(color='black') {
    lineLayer[0].clearLayers();
    var polyOptions = { color:color };
    var poly = L.polyline(globalLineCollector, polyOptions).addTo(lineLayer[0]);

    var spacer = Array(3).join(" "); // repeater. from https://stackoverflow.com/a/1877479/4355695
    // putting arrows. See https://github.com/makinacorpus/Leaflet.TextPath
    poly.setText(spacer+'>'+spacer, {repeat: true, offset: 6, attributes: {'font-weight': 'bold', 'font-size': '18', 'fill':color}}) // ►
}

function zoomFit() {
    map[0].fitBounds(stopsLayer[0].getBounds(), {padding:[5,5], maxZoom:17});
}
