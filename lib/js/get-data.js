//adapted from the cerner smart on fhir guide. updated to utalize client.js v2 library and FHIR R4


var sodiumLevel = null;
var patientWeight = null;
var bloodPressureLevel = null;
// helper function to process fhir resource to get the patient name.
function getPatientName(pt) {
  if (pt.name) {
    var names = pt.name.map(function(name) {
      return name.given.join(" ") + " " + name.family;
    });
    return names.join(" / ")
  } else {
    return "anonymous";
  }
}

// display the patient name gender and dob in the index page
function displayPatient(pt) {
  document.getElementById('patient_name').innerHTML = getPatientName(pt);
  document.getElementById('gender').innerHTML = pt.gender;
  document.getElementById('dob').innerHTML = pt.birthDate;
}

//helper function to get quanity and unit from an observation resoruce.
function getQuantityValueAndUnit(ob) {
  if (typeof ob != 'undefined' &&
      typeof ob.valueQuantity != 'undefined' &&
      typeof ob.valueQuantity.value != 'undefined' &&
      typeof ob.valueQuantity.unit != 'undefined') {
    return Number(parseFloat((ob.valueQuantity.value)).toFixed(2)) + ' ' + ob.valueQuantity.unit;
  } else {
    return undefined;
  }
}

//helper function to get quanity  resoruce.
function getQuantityValueWithoutUnit(ob) {
  if (typeof ob != 'undefined' &&
      typeof ob.valueQuantity != 'undefined' &&
      typeof ob.valueQuantity.value != 'undefined' &&
      typeof ob.valueQuantity.unit != 'undefined') {
    return Number(parseFloat((ob.valueQuantity.value)).toFixed(2));
  } else {
    return undefined;
  }
}

//calculate hypernatremia
function totalWaterDeficit(desiredNa, serumNa, weight){
  let totalBodyWater;
  let waterDeficit;
  if (serumNa != 'undefined' && weight != 'undefined') {
    totalBodyWater = 0.5 * weight;
    waterDeficit = totalBodyWater - (desiredNa / serumNa);
    return waterDeficit.toFixed(2) + ' ' + 'L';
  }
  return "";
}

function sodiumRequirement(desiredNa, serumNa, weight){
  let totalBodyWater;
  let naRequirement;
  if (serumNa != 'undefined' && weight != 'undefined') {
    totalBodyWater = 0.5 * weight;
    naRequirement = totalBodyWater * (desiredNa - serumNa);
    return naRequirement.toFixed(2) + ' ' + 'mmol';
  }
  return "";
}


// helper function to get both systolic and diastolic bp
function getBloodPressureValue(BPObservations, typeOfPressure) {
  var formattedBPObservations = [];
  BPObservations.forEach(function(observation) {
    var BP = observation.component.find(function(component) {
      return component.code.coding.find(function(coding) {
        return coding.code == typeOfPressure;
      });
    });
    if (BP) {
      observation.valueQuantity = BP.valueQuantity;
      formattedBPObservations.push(observation);
    }
  });

  return getQuantityValueAndUnit(formattedBPObservations[0]);
}

// create a patient object to initalize the patient
function defaultPatient() {
  return {
    weight: {
      value: ''
    },
    sys: {
      value: ''
    },
    sodium: {
      value: ''
    },
    // defWater: {
    //   value: ''
    // },
    // nareq: {
    //   value: ''
    // },
    note: 'No Annotation',
  };
}

//helper function to display the annotation on the index page
function displayAnnotation(annotation) {
  note.innerHTML = annotation;
}

//function to display the observation values you will need to update this
function displayObservation(obs) {
  weight.innerHTML =obs.weight;
  sys.innerHTML =obs.sys;
  sodium.innerHTML =obs.sodium;
  //defWater.innerHTML =obs.defWater;
  //nareq.innerHTML = obs.nareq;
  note.innerHTML = obs.note;
}

var weightObs = null;

//once fhir client is authorized then the following functions can be executed
FHIR.oauth2.ready().then(function(client) {

  // get patient object and then display its demographics info in the banner
  client.request(`Patient/${client.patient.id}`).then(
      function(patient) {
        displayPatient(patient);
        console.log(patient);
      }
  );


  // you will need to update the below to retrive the weight and height values
  var query = new URLSearchParams();


  query.set("patient", client.patient.id);
  query.set("_count", 100);
  query.set("_sort", "-date");
  query.set("code", [
    'http://loinc.org|8462-4',
    'http://loinc.org|8480-6',
    'http://loinc.org|2085-9',
    'http://loinc.org|2089-1',
    'http://loinc.org|55284-4',
    'http://loinc.org|3141-9',
    'http://loinc.org|3137-7',
    'http://loinc.org|8301-4',
    'http://loinc.org|8302-2',
    'http://loinc.org|8335-2',
    'http://loinc.org|29463-7',
    'http://loinc.org|2947-0', // add sodium levels
  ].join(","));

  client.request("Observation?" + query, {
    pageLimit: 0,
    flat: true
  }).then(
      function(ob) {

        // group all of the observation resoruces by type into their own
        var byCodes = client.byCodes(ob, 'code');
        var weight = byCodes('29463-7'); //use body weight code
        var sodium = byCodes('2947-0');
        var systolicbp = getBloodPressureValue(byCodes('55284-4'), '8480-6');
        //var defWater = null;


        // create patient object
        var p = defaultPatient();


        // set patient value parameters to the data pulled from the observation resoruce
        if (typeof systolicbp != 'undefined') {
          p.sys = systolicbp;
        } else {
          p.sys = 'undefined'
        }
        p.weight = getQuantityValueAndUnit(weight[0]);
        p.sodium = getQuantityValueAndUnit(sodium[0]);
        sodiumLevel = getQuantityValueWithoutUnit(sodium[0]);
        patientWeight = getQuantityValueWithoutUnit(weight[0]);
        bloodPressureLevel = getQuantityValueWithoutUnit(systolicbp[0]);
        displayObservation(p)

      });

  //
  // function displayDiagnosis(){
  //   if(sodiumLevel > 142 && sodiumLevel != undefined){
  //     hyper.innerHTML = 'Serum sodium levels are too high. Treat patient with water according to deficit value indicated.';
  //   }
  //   else if (sodiumLevel < 137.5 && sodiumLevel != undefined){
  //     hyper.innerHTML = 'Serum sodium levels are too low. Treat patient with sodium according to sodium requirement value.'
  //   }
  //   else if (sodiumLevel > 137.5 && sodiumLevel < 142 && sodiumLevel != undefined){
  //     hyper.innerHTML = 'Serum sodium levels are optimal. No treatment needed.'
  //   }
  //   else if(sodiumLevel == undefined) {
  //     hyper.innerHTML = 'No information available on serum sodium of patient.'
  //   }
  //   else{
  //     hyper.innerHTML= 'Diagnosis cannot be made.'
  //   }
  // }
  function displayDiagnosis(){
    if(sodiumLevel > 142 && sodiumLevel != undefined){
      hyper.innerHTML = bloodPressureLevel;
    }
    else if (sodiumLevel < 137.5 && sodiumLevel != undefined){
      hyper.innerHTML = bloodPressureLevel
    }
    else if (sodiumLevel > 137.5 && sodiumLevel < 142 && sodiumLevel != undefined){
      hyper.innerHTML = bloodPressureLevel
    }
    else if(sodiumLevel == undefined) {
      hyper.innerHTML = bloodPressureLevel
    }
    else{
      hyper.innerHTML= bloodPressureLevel
    }
  }
  function displaySodiumReqandDeficit(){
    var desiredSodium = annotation.value;
    var deficitWater = totalWaterDeficit(desiredSodium, sodiumLevel, patientWeight);
    var sodiumReq = sodiumRequirement(desiredSodium,sodiumLevel,patientWeight);
    defWater.innerHTML = deficitWater;
    nareq.innerHTML = sodiumReq;

  }



  document.getElementById('add').addEventListener('click', displaySodiumReqandDeficit);

  //event listner when the a button is clicked to call the function that display diagnosis
  document.getElementById('diagButton').addEventListener('click', displayDiagnosis);
  // KNN algorithm adapated from https://burakkanber.com/blog/machine-learning-in-js-k-nearest-neighbor-part-1/
  /*
   * Expected keys in object:
   * sodium_levels, blood_pressure, type
   */
  var Node = function(object) {
    for (var key in object)
    {
      this[key] = object[key];
    }
  };
  Node.prototype.measureDistances = function(blood_pressure_range_obj, sodium_levels_range_obj) {
    var sodium_levels_range = sodium_levels_range_obj.max - sodium_levels_range_obj.min;
    var blood_pressure_range  = blood_pressure_range_obj.max  - blood_pressure_range_obj.min;

    for (var i in this.neighbors)
    {
      /* Just shortcut syntax */
      var neighbor = this.neighbors[i];

      var delta_sodium_levels = neighbor.sodium_levels - this.sodium_levels;
      delta_sodium_levels = (delta_sodium_levels ) / sodium_levels_range;

      var delta_blood_pressure  = neighbor.blood_pressure  - this.blood_pressure;
      delta_blood_pressure = (delta_blood_pressure ) / blood_pressure_range;

      neighbor.distance = Math.sqrt( delta_sodium_levels*delta_sodium_levels + delta_blood_pressure*delta_blood_pressure );
    }
  };
  Node.prototype.sortByDistance = function() {
    this.neighbors.sort(function (a, b) {
      return a.distance - b.distance;
    });
  };
  Node.prototype.guessType = function(k) {
    var types = {};

    for (var i in this.neighbors.slice(0, k))
    {
      var neighbor = this.neighbors[i];

      if ( ! types[neighbor.type] )
      {
        types[neighbor.type] = 0;
      }

      types[neighbor.type] += 1;
    }

    var guess = {type: false, count: 0};
    for (var type in types)
    {
      if (types[type] > guess.count)
      {
        guess.type = type;
        guess.count = types[type];
      }
    }

    this.guess = guess;

    return this.guess.type;
  };

  var NodeList = function(k) {
    this.nodes = [];
    this.k = k;
  };

  NodeList.prototype.add = function(node) {
    this.nodes.push(node);
  };

  NodeList.prototype.determineUnknown = function() {

    this.calculateRanges();

    /*
     * Loop through our nodes and look for unknown types.
     */
    for (var i in this.nodes)
    {

      if ( ! this.nodes[i].type)
      {
        /*
         * If the node is an unknown type, clone the nodes list and then measure distances.
         */

        /* Clone nodes */
        this.nodes[i].neighbors = [];
        for (var j in this.nodes)
        {
          if ( ! this.nodes[j].type)
            continue;
          this.nodes[i].neighbors.push( new Node(this.nodes[j]) );
        }

        /* Measure distances */
        this.nodes[i].measureDistances(this.blood_pressures, this.sodium_levels);

        /* Sort by distance */
        this.nodes[i].sortByDistance();

        /* Guess type */
        console.log(this.nodes[i].guessType(this.k));
        return this.nodes[i].guessType(this.k);

      }
    }
  };
  NodeList.prototype.calculateRanges = function() {
    this.blood_pressures = {min: 1000000, max: 0};
    this.sodium_levels = {min: 1000000, max: 0};
    for (var i in this.nodes)
    {
      if (this.nodes[i].sodium_levels < this.sodium_levels.min)
      {
        this.sodium_levels.min = this.nodes[i].sodium_levels;
      }

      if (this.nodes[i].sodium_levels > this.sodium_levels.max)
      {
        this.sodium_levels.max = this.nodes[i].sodium_levels;
      }

      if (this.nodes[i].blood_pressure < this.blood_pressures.min)
      {
        this.blood_pressures.min = this.nodes[i].blood_pressure;
      }

      if (this.nodes[i].blood_pressure > this.blood_pressures.max)
      {
        this.blood_pressures.max = this.nodes[i].blood_pressure;
      }
    }

  };
  NodeList.prototype.draw = function(canvas_id) {
    var sodium_levels_range = this.sodium_levels.max - this.sodium_levels.min;
    var blood_pressures_range = this.blood_pressures.max - this.blood_pressures.min;

    var canvas = document.getElementById(canvas_id);
    var ctx = canvas.getContext("2d");
    var width = 400;
    var height = 400;
    ctx.clearRect(0,0,width, height);

    for (var i in this.nodes)
    {
      ctx.save();

      switch (this.nodes[i].type)
      {
        case 'myocardioinfaction':
          ctx.fillStyle = 'red';
          break;
        case 'normal':
          ctx.fillStyle = 'green';
          break;
        case 'flat':
          ctx.fillStyle = 'blue';
          break;
        default:
          ctx.fillStyle = '#666666';
      }

      var padding = 40;
      var x_shift_pct = (width  - padding) / width;
      var y_shift_pct = (height - padding) / height;

      var x = (this.nodes[i].sodium_levels - this.sodium_levels.min) * (width  / sodium_levels_range) * x_shift_pct + (padding / 2);
      var y = (this.nodes[i].blood_pressure  - this.blood_pressures.min) * (height / blood_pressures_range) * y_shift_pct + (padding / 2);
      y = Math.abs(y - height);


      ctx.translate(x, y);
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI*2, true);
      ctx.fill();
      ctx.closePath();


      /*
       * Is this an unknown node? If so, draw the radius of influence
       */

      if ( ! this.nodes[i].type )
      {
        switch (this.nodes[i].guess.type)
        {
          case 'myocardioinfaction':
            ctx.strokeStyle = 'red';
            break;
          case 'normal':
            ctx.strokeStyle = 'green';
            break;
          case 'flat':
            ctx.strokeStyle = 'blue';
            break;
          default:
            ctx.strokeStyle = '#666666';
        }

        var radius = this.nodes[i].neighbors[this.k - 1].distance * width;
        radius *= x_shift_pct;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI*2, true);
        ctx.stroke();
        ctx.closePath();

      }

      ctx.restore();

    }

  };

  var nodes;

  var data = [
    {sodium_levels: 141.2, blood_pressure: 173.86, type: 'myocardioinfaction'},
    {sodium_levels: 143, blood_pressure: 194.168, type: 'myocardioinfaction'},
    {sodium_levels: 140, blood_pressure: 111.66, type: 'myocardioinfaction'},
    {sodium_levels: 141, blood_pressure: 135, type: 'normal'},
    {sodium_levels: 140.13, blood_pressure: 123.78, type: 'normal'},
    {sodium_levels: 138.51, blood_pressure: 116.22, type: 'normal'},

  ];
  var run = function(sodium, BP) {

    nodes = new NodeList(3);
    for (var i in data)
    {
      nodes.add( new Node(data[i]) );
    }
    var random_sodium_levels = sodium;
    var random_blood_pressure = BP;
    nodes.add( new Node({sodium_levels: random_sodium_levels, blood_pressure: random_blood_pressure, type: false}) );

    risk.innerHTML = nodes.determineUnknown();
    nodes.draw("canvas");
  };



  function displayHeartRiskDiagnosis(){
    if(sodiumLevel != undefined && bloodPressureLevel != undefined ){
      //console.log("enough data available")
      run(sodiumLevel,bloodPressureLevel);

    }else{
      risk.innerHTML = 'Not enough data on the patient files. Heart risk diagnosis cannot be made.'
    }
  }
  document.getElementById('riskdiagButton').addEventListener('click', displayHeartRiskDiagnosis);
//setInterval(run, 5000);
//run()
}).catch(console.error);
