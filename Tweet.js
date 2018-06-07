'use strict';
const Sentence = require('./Sentence.js');

var pattStartWithUpper = /^[A-Z]/;
var pattRepeatedConsecutiveWords = /([A-Z]*(\s+[A-Z]*))/;

//Constantes
var numberOfJoinMix = 6;
var totalCharacters = process.env.TWITTER_CHAR_LIMIT;
var similarRange = 2; //Diferencia de Caracteres para encontrar similar (+)
var similarSustantivosRange = 2; //Diferencia de Caracteres para encontrar similar en Sustantivos Propios (+)

//Constructor
function Tweet(sentence1, sentence2) {
  this.sentence1;
  this.sentence2;
  this.finalText;
  this.selectedMediaUrl;

  this.initTweet(sentence1, sentence2);
}

Tweet.prototype.initTweet = function(sentence1, sentence2){
	//console.log('[S1]['+sentence1.finalText+']');
	//console.log('[S2]['+sentence2.finalText+']');

	if(sentence1.evaluation >= sentence2.evaluation){
		this.sentence1 = sentence1;
		this.sentence2 = sentence2;
		
		//Media
		if(sentence1.mediaUrl != null)
			this.selectedMediaUrl = sentence1.mediaUrl;
		else if(sentence2.mediaUrl != null)
			this.selectedMediaUrl = sentence2.mediaUrl;
	}else{
		this.sentence1 = sentence2;
		this.sentence2 = sentence1;
		
		//Media
		if(sentence2.mediaUrl != null)
			this.selectedMediaUrl = sentence2.mediaUrl;
		else if(sentence1.mediaUrl != null)
			this.selectedMediaUrl = sentence1.mediaUrl;
	}

	this.sentence1.leftOrRight = 0;
	this.sentence2.leftOrRight = 1;

	console.log('S1['+this.sentence1.finalText+']['+this.sentence1.leftOrRight+']');
	console.log('S2['+this.sentence2.finalText+']['+this.sentence2.leftOrRight+']');
};

Tweet.prototype.gimmeFinalTweet = function() {
	//ADD logica de generacion de twit con las sentences listas.
	this.applySintaxis();

	//Se genera el texto FINAL
	this.finalText = this.sentence1.finalText.trim().concat(" ").concat(this.sentence2.finalText);

	//Borrar palabra final con largo 1
	this.deleteSingleLastWord();

	//Se busca cerrar " y ¿
	this.addCloseSentenceExpression();

};

Tweet.prototype.applySintaxis = function(){

	//Validar si tienen indexOfCut
	//Si los dos tienen index of cut, la frase esta hecha.
	this.sentence1.cutToIndexOfCut();
	this.sentence2.cutToIndexOfCut();
	this.sentence1.purifyLeft();
	this.sentence2.purifyRight();
	//console.log('S1.indexOfCut:'+this.sentence1.indexOfCut+'- S2.indexOfCut:'+this.sentence2.indexOfCut);
	if(this.sentence1.indexOfCut > 0 && this.sentence2.indexOfCut > 0){
		console.log('OK-> Doble cut');
		return;
	}else if(this.sentence1.indexOfCut > 0 && this.sentence2.indexOfCut == 0){
		console.log('OK-> Just S1 cut + cutToBaseNumberOfWords(S2)');
		this.sentence2.startUpper = true;
		this.sentence2.cutToBaseNumberOfWords();
		this.sentence2.purifyRight();
		return;
	}else if(this.sentence2.indexOfCut > 0 && this.sentence1.indexOfCut == 0){
		console.log('OK-> Just S2 cut + cutToBaseNumberOfWords(S1)');
		this.sentence1.startUpper = true;
		this.sentence1.cutToBaseNumberOfWords();
		this.sentence1.purifyLeft();
		return;
	}

	//Buscar join mix:::MEjorar
	this.sentence1.purifyLeft();
	this.sentence2.purifyRight();
	if(this.findJoinMix()==1){
		console.log('OK-> findJoinMix');
		return;
	}

	
	
	
	//[Base] Generar Twitt base
	this.generateBasicTwit();
	console.log('[ERROR:FORCED]-> generateBasicTwit');
	//this.lastHalfRepeatedWords();
	

}


/**************************************************************************
********************** COMPARATIVES **************************************
**************************************************************************/

/**************************************************************************
** findJoinMix: Busca una palabra comun entre las N ultimas palabras de FirstHalf y las N primeras de LastHalf
** Si encuentra genera la frase completa, de lo contrario, retorna undefined
**************************************************************************/
Tweet.prototype.findJoinMix = function(){
	var firstHalfArray = this.sentence1.finalText.split(" ");
	var lastHalfArray = this.sentence2.finalText.split(" ");
	//console.log(firstHalfArray);
	
	//Buscamos las ultimas 'numberOfJoinMix' de firstHalf
	var x = firstHalfArray.length > numberOfJoinMix ? firstHalfArray.length-numberOfJoinMix: 0;
	//console.log(x+">>firstHalfArray.length:"+firstHalfArray.length+"-numberOfJoinMix:"+numberOfJoinMix);
	for (var i = x; i < firstHalfArray.length; i++){
		//Buscamos las primeras 'numberOfJoinMix' de lastHalf
		for (var j = 0; j < numberOfJoinMix; j++){
			//console.log('firstHalfArray['+i+']:['+firstHalfArray[i]+'] -- lastHalfArray['+j+']:['+lastHalfArray[j]+']');
			if(firstHalfArray[i]!== undefined && lastHalfArray[j]!== undefined && firstHalfArray[i] == lastHalfArray[j]){//Identicos
				console.log('Identicos encontrado >> firstHalfArray['+i+']['+firstHalfArray[i]+'] -- lastHalfArray['+j+']:['+lastHalfArray[j]+']');
				//Cortar las partes
				firstHalfArray = firstHalfArray.slice(0, i);
				lastHalfArray = lastHalfArray.slice(j);

				this.sentence1.finalText = firstHalfArray.join(" ");
				this.sentence2.finalText = lastHalfArray.join(" ");
				//Generar la frase y retornar
				return 1;
			}
		}
	}

	return this.findSimilarJoinMix();
};

/**************************************************************************
** findSimilarJoinMix: Busca una palabra comun entre las N ultimas palabras de FirstHalf y las N primeras de LastHalf
** Si encuentra genera la frase completa, de lo contrario, retorna undefined
**************************************************************************/
Tweet.prototype.findSimilarJoinMix = function(){
	var firstHalfArray = this.sentence1.finalText.split(" ");
	var lastHalfArray = this.sentence2.finalText.split(" ");
	//console.log(firstHalfArray);

	var x = firstHalfArray.length > numberOfJoinMix ? firstHalfArray.length-numberOfJoinMix: 0;
	var y = lastHalfArray.length > numberOfJoinMix ? numberOfJoinMix: lastHalfArray.length;
	//console.log(x+">>firstHalfArray.length:"+firstHalfArray.length+"-numberOfJoinMix:"+numberOfJoinMix);
	//Buscamos las ultimas 'numberOfJoinMix' de firstHalf
	for (var i = x; i < firstHalfArray.length; i++){
		//Buscamos las primeras 'numberOfJoinMix' de lastHalf
		for (var j = 0; j < y; j++){
			//console.log('firstHalfArray['+i+']:['+firstHalfArray[i]+'] -- lastHalfArray['+j+']:['+lastHalfArray[j]+']');
			if(i > 0 && firstHalfArray[i].search(lastHalfArray[j]) >= 0 || lastHalfArray[j].search(firstHalfArray[i]) >= 0){ //Similares
				if(firstHalfArray[i]!=undefined && lastHalfArray[j]!=undefined && firstHalfArray[i].length > 0 && lastHalfArray[j].length > 0 && (firstHalfArray[i].length == (lastHalfArray[j].length+similarRange) || lastHalfArray[j].length == (firstHalfArray[i].length+similarRange))){
					console.log('Similares encontrado >> firstHalfArray['+i+']['+firstHalfArray[i]+'] -- lastHalfArray['+j+']:['+lastHalfArray[j]+']');

					//Palabra izquierda es menor o igual
					if(firstHalfArray[i].length <= lastHalfArray[j].length){
						//console.log('A-firstHalfArray['+firstHalfArray[j]+']');
						//console.log('A-lastHalfArray['+lastHalfArray[j]+']');

						firstHalfArray = firstHalfArray.slice(0, i+1);
						if(this.isSustantivoPropio(lastHalfArray[j])){
							lastHalfArray = lastHalfArray.slice(j);
						}else{
							lastHalfArray = lastHalfArray.slice(j+1);
						}
					}else{//Palabra derecha es mator
						//console.log('B-firstHalfArray['+firstHalfArray[j]+']');
						//console.log('B-lastHalfArray['+lastHalfArray[j]+']');
						if(this.isSustantivoPropio(lastHalfArray[j])){
							firstHalfArray = firstHalfArray.slice(0, i+1);
						}else{
							firstHalfArray = firstHalfArray.slice(0, i);
						}
						
						lastHalfArray = lastHalfArray.slice(j);
					}
					this.sentence1.finalText = firstHalfArray.join(" ");
					this.sentence2.finalText = lastHalfArray.join(" ");
					//Generar la frase y retornar
					return 1;
				}
			}
		}
	}
	return this.findSustantivosPropiosJoinMix();	
};

/**************************************************************************
** findSustantivosPropiosJoinMix: Busca una palabra comun entre las N ultimas palabras de FirstHalf y las N primeras de LastHalf
** Si encuentra genera la frase completa, de lo contrario, retorna undefined
**************************************************************************/
Tweet.prototype.findSustantivosPropiosJoinMix = function(){
	var firstHalfArray = this.sentence1.finalText.split(" ");
	var lastHalfArray = this.sentence2.finalText.split(" ");
	//console.log(firstHalfArray);
	var x = firstHalfArray.length > numberOfJoinMix ? firstHalfArray.length-numberOfJoinMix: 0;
	var y = lastHalfArray.length > numberOfJoinMix ? numberOfJoinMix: lastHalfArray.length;
	//Buscamos las ultimas 'numberOfJoinMix' de firstHalf
	for (var i = x; i < firstHalfArray.length; i++){
		//Buscamos las primeras 'numberOfJoinMix' de lastHalf
		for (var j = 0; j < y; j++){
			//console.log('firstHalfArray['+i+']:['+firstHalfArray[i]+'] -- lastHalfArray['+j+']:['+lastHalfArray[j]+']');

			if(this.isSustantivoPropio(firstHalfArray[i]) && this.isSustantivoPropio(lastHalfArray[j])){ //Sustantivos Propios
				if(firstHalfArray[i].length > 0 && lastHalfArray[j].length > 0 && (firstHalfArray[i].length == (lastHalfArray[j].length+similarSustantivosRange) || lastHalfArray[j].length == (firstHalfArray[i].length+similarSustantivosRange))){
					console.log('Sustantivos Propios encontrado >> firstHalfArray['+i+']['+firstHalfArray[i]+'] -- lastHalfArray['+j+']:['+lastHalfArray[j]+']');
					firstHalfArray = firstHalfArray.slice(0, i);
					lastHalfArray = lastHalfArray.slice(j);
					//console.log('firstHalfArray['+firstHalfArray+']');
					//console.log('lastHalfArray['+lastHalfArray+']');
					this.sentence1.finalText = firstHalfArray.join(" ");
					this.sentence2.finalText = lastHalfArray.join(" ");
					//Generar la frase y retornar
					return 1;
				}
			}
		}
	}
	return 0;	
};




/**************************************************************************
** generateBasicTwit: Genera un twit basico por separacion de N palabras y concatenacion
**************************************************************************/
Tweet.prototype.generateBasicTwit = function(){
	//Logica para generar twit con corte. Se modifica para generar error de largo de caracteres y lance otra busqueda de sentence.
	//Corte base de la frase. Equitativo para ambas palabras
	this.sentence1.cutToBaseNumberOfWords();
	this.sentence2.cutToBaseNumberOfWords();

	var totalLength = this.sentence1.finalText.length+this.sentence2.finalText.length;
	if(totalLength > totalCharacters){
		//Cortar una letra por cada frase
		this.sentence1.removeOneWord();
		this.sentence2.removeOneWord();
		this.generateBasicTwit();
	}
};


/**************************************************************************
** lastHalfRepeatedWords: Chequea que la ultima palabra de firstHalf sea distinto de lastHalf
** Retorna lastHalf sin el caracter común.
**************************************************************************/
Tweet.prototype.lastHalfRepeatedWords = function() {
	var firstHalfArray = this.sentence1.finalText.split(" ");
	var lastHalfArray = this.sentence2.finalText.split(" ");

	//Comparar ultima palabra de firstHalf con la primera de lastHalfArray
	//console.log('F1-last:'+firstHalf[firstHalf.length-1] + ' --- F2-first:'+lastHalfArray[0]);
	if(firstHalfArray[firstHalfArray.length-1] == lastHalfArray[0]){
		lastHalfArray = lastHalfArray.slice(1);
		this.sentence2=lastHalfArray.join(" ");
	}
};

/**************************************************************************
** addCloseSentenceExpression: Si existe un " abierto, lo cierra. Lo mismo para ¿
** Retorna lastHalf sin el caracter común.
**************************************************************************/
Tweet.prototype.addCloseSentenceExpression = function() {

	var dosPuntos = this.finalText.indexOf(":");

	var interrogacionInicio = this.finalText.indexOf("¿");
	var interrogacionFin = this.finalText.lastIndexOf("?");

	if(interrogacionInicio >= 0 && interrogacionFin==-1){
		this.finalText = this.finalText.concat("?");
	}else if(interrogacionFin > 0 && interrogacionInicio==-1){
		if(dosPuntos >= 0){
			this.finalText = this.finalText.slice(0, dosPuntos+1).concat(" ¿").concat(this.finalText.slice(dosPuntos+1, this.finalText.length).trim());
		}else{
			this.finalText = "¿" + this.finalText;
		}
	}

	var exclamacionInicio = this.finalText.indexOf("¡");
	var exclamacionFin = this.finalText.lastIndexOf("!");
	if(exclamacionInicio >= 0 && exclamacionFin == -1){
		this.finalText = this.finalText.concat("!");
	}else if(exclamacionFin > 0 && exclamacionInicio==-1){
		if(dosPuntos >= 0){
			this.finalText = this.finalText.slice(0, dosPuntos+1).concat(" ¡").concat(this.finalText.slice(dosPuntos+1, this.finalText.length).trim());
		}else{
			this.finalText = "¡" + this.finalText;
		}
	}

	var comillaInicio = this.finalText.indexOf("\"");
	var comillaFin = this.finalText.lastIndexOf("\"");
	if(comillaInicio >= 0 && comillaInicio==comillaFin){
		if(comillaInicio+1 == this.finalText.length){ //Si la comilla esta al final, agregar al principio
			//Poner despues de :, si existe
			if(dosPuntos >= 0){
				this.finalText = this.finalText.slice(0, dosPuntos+1).concat(" \"").concat(this.finalText.slice(dosPuntos+1, this.finalText.length).trim());
			}else{
				this.finalText = "\"" + this.finalText;
			}
			
		}else{
			this.finalText = this.finalText.concat("\"");
		}
		
	}

};

/**************************************************************************
** deleteSingleLastWord: Elimina la ultima palabra si solo tiene un caracter
**************************************************************************/
Tweet.prototype.deleteSingleLastWord = function() {
	var finalTextArray = this.finalText.split(" ");
	//Comparar ultima palabra de firstHalf con la primera de lastHalfArray
	if(finalTextArray[finalTextArray.length-1].length == 1){
		this.finalText = this.finalText.slice(0, this.finalText.length-1);
	}
};

/**************************************************************************
** checkTwitterLong: Validar que se cumplan los caracteres
**************************************************************************/
Tweet.prototype.checkTwitterLong = function(str){
	return str.length <= totalCharacters;
};

/**************************************************************************
** isSustantivoPropio: Validar que comience con Mayuscula
**************************************************************************/
Tweet.prototype.isSustantivoPropio = function(str){
	return pattStartWithUpper.test(str);
};

// export the class
module.exports = Tweet;