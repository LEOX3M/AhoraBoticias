/**************************************************************************
** TODO: OBJETIVIZAR!!!
** - Separar en 3 etapas de funciones:
** --- INICIO: Buscar twits y purificarlos
** --- DEFINE FIRST and LAST HALF: 
** --- JOIN FIRST and HALF: Aplicar logica de sintaxis (palabras centrales iguales, last comenzar con minuscula si first no termina en puntuacion o es el inicio de la frase, etc)
**************************************************************************/
'use strict';
require('dotenv').config();
const Sentence = require('./Sentence.js');
const Tweet = require('./Tweet.js');
const Twit = require('twit');
const request = require('request').defaults({ encoding: null });

var T = new Twit({
	consumer_key:         process.env.CONSUMER_KEY,
	consumer_secret:      process.env.CONSUMER_SECRET,
	access_token:         process.env.ACCESS_TOKEN,
	access_token_secret:  process.env.ACCESS_TOKEN_SECRET,
});

/**************************************************************************
** SOURCES. 
** REMOVES 'chilevision', 'TerraChile', 'el_dinamo', 
**************************************************************************/
var sourcesArray = process.env.SOURCE_ARRAY.split(' ');
//var sourcesArray = ['biobio', 'adnradiochile','bbcmundo', 'Cooperativa', '24HorasTVN', 'CNNChile', 'latercera', 'elmostrador', 'thecliniccl', 'Deportes13cl', 'ahoranoticiasAN', 'DiarioLaHora', 'nacioncl', 'Tele13_Radio', 'lacuarta','ElGraficoChile', 'soychilecl', 'emol', 'CNNEE', 'ElNacionalWeb', 'el_pais'];
//var sourcesArray = ['cnnbrk', 'BBCWorld', 'BBCBreaking', 'nytimes', 'FoxNews', 'WSJ', 'ABC', 'TheEconomist', 'washingtonpost', 'AP', 'AJEnglish', 'CBSNews', 'SkyNewsBreak', 'enews', 'cnni'];
var totalCharacters = process.env.TWITTER_CHAR_LIMIT;

//RUN, BITCH!
tweetIt();
setInterval( function() {  tweetIt();  }, process.env.TWEET_TIME ); //1000*60*10


function tweetIt() {
	// Instantiate User:
	var sentence1 = new Sentence('sentence1');
	var sentence2 = new Sentence('sentence2');
	//Buscar Fuentes
	sentence1.source = randomSource();
	sentence2.source = randomSource(sentence1.source);

	//GET Sentence1
	var count = randomCount();
	T.get('statuses/user_timeline', { screen_name: sentence1.source, count: count }, function (err, data, response) {
		sentence1.initSentence(data);
		if(!sentence1.validSentence){
			console.log('_____________________________________');
			tweetIt();
			return;
		}
		
		//GET Sentence2
		T.get('statuses/user_timeline', { screen_name: sentence2.source, count: count }, function (err, data, response) {
			sentence2.initSentence(data);
			if(!sentence2.validSentence){
				console.log('_____________________________________');
				tweetIt();
				return;
			}
			//OBTENER FINAL TEXT
			var finalTwit = new Tweet(sentence1, sentence2);
			finalTwit.gimmeFinalTweet();
			
			console.log('>>>'+finalTwit.finalText);
			console.log('Length:'+finalTwit.finalText.length+' | '+finalTwit.sentence1.source+ ' -vs- '+ finalTwit.sentence2.source);

			if(finalTwit.finalText.length > totalCharacters){
				console.log('_____________________________________');
				tweetIt();
				return;
			}

			//¡¡¡SEND TWIT!!!
			if(finalTwit.selectedMediaUrl!=null){
				postItWithMedia(finalTwit);
			}else{
				postIt(finalTwit);
			}

		});
		
	});
}


function postIt(finalTwit){
	T.post('statuses/update', {status: finalTwit.finalText}, function (err, data, response) {
		if(!err){
			console.log("Posteado :)");
		}else{
			console.log("Retrying :(");
			tweetIt();
		}		
	});
}

function postItWithMedia(finalTwit){
	
	request.get(finalTwit.selectedMediaUrl, function (error, response, body) {
	    if (!error && response.statusCode == 200) {
	    	var b64content = new Buffer(body).toString('base64');
			T.post('media/upload', { media_data: b64content }, function (err, data, response) {
				//console.log('media/upload');
				var mediaIdStr = data.media_id_string;
				var meta_params = { media_id: mediaIdStr, alt_text: { text: "Iamnotiluminati" } }
				T.post('media/metadata/create', meta_params, function (err, data, response) {			  
					if (!err) {
						var params = { status: finalTwit.finalText, media_ids: [mediaIdStr] }
						T.post('statuses/update', params, function (err, data, response) {
							if(!err){
								console.log("Posteado WithMedia:["+finalTwit.selectedMediaUrl+"]");
							}else{
								console.log("Retrying WithMedia :(");
								tweetIt();
							}	
						});
					}else{
						console.log("Retrying WithMedia :(");
						tweetIt();
					}
				});
			});
		}else{
			console.log("Error: "+error);
		}
	});
}



/**************************************************************************
********************* UTILS ***********************************************
**************************************************************************/

/**************************************************************************
** randomSource: Busca aleatoreamente una fuente de twitter. 
** Si sourceAvoid existe, se entrega obligatoriamente otra fuente.
**************************************************************************/
function randomSource(sourceAvoid){
	//console.log('sourceAvoid:'+sourceAvoid);
	if(sourceAvoid == undefined){
		return sourcesArray[Math.floor(Math.random() * sourcesArray.length)];
	}else{
		var sourceSelected = sourcesArray[Math.floor(Math.random() * sourcesArray.length)];
		//console.log('sourceSelected:'+sourceSelected);
		if(sourceSelected == sourceAvoid)
			return randomSource(sourceAvoid);
		else
			return sourceSelected;
	}
}

/**************************************************************************
** randomCount: Busca aleatoreamente un contador
**************************************************************************/
function randomCount(){
	return Math.floor(Math.random() * 10) + 1 ;
}
