'use strict';

var pattURL = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
var pattStartWithRT = /^(RT.@[\w]*:)/i;

//Evaluation
var pattDosPuntos = /:/; //Tiene dos puntos. Mayor index, mayor puntaje
var pattPuntuacion = /,|;|.|/;//Tiene otro tipo de puntuacion. Mayor index, mayor puntaje
var pattStartWithHashtag = /^#/;//Comienza con apertura de puntuacion
var pattStartWithInterrogation = /^\?+/
var pattStartWithOpenPuntuacion = /^(¿|"|\[|¡)/;//Comienza con apertura de puntuacion
var pattEndOpenPuntuacion = /(¿.*\?)|(\".*\")|(\¡.*\!)|(\[.*\])/i;//Grupo de puntuacion

var pattStartWithCorchetes = /^\[([a-z\d][\w-]*)\]/i;//Comienza con corchetes
var pattEndHashtag = /(#[a-z\d][\w-]*)$/;
var pattHasPuntuacion = /(¿|"|\[|¡|#)/;//Comienza con apertura de puntuacion.

var pattEmoji = /\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]/;
var pattTwoSpaces = /\s\s/;

var pattIsUpperCase = /^[^a-z]*$/;
var pattStartWithUpper = /^[A-Z]/;
var pattConsecutiveUpperCaseWords = /([A-Z]*.[A-Z]*)/;

//Constantes
var numberOfWordsBase = 10;


// Constructor
function Sentence(name) {
	this.name = name;
	this.originalText;
  	this.finalText;
	this.truncated;
	this.mediaUrl;
	this.source;
	this.leftOrRight; // 0= left, 1=rigth
	this.evaluation = 100; //Valor se va descontando segun caracteristicas de ser lastHalf
	this.indexOfCut; //Indice en el que, tras evaluar, seria recomendable cortar.
	this.removeEmojis=true;
	this.validSentence = true;
	this.startUpper = false;
}

Sentence.prototype.initSentence = function(data){
	this.obtainImportantData(data);
	this.purifyInitialText();
	this.evaluate();

	this.validateSentence();
};

/**************************************************************************
** 1. obtainImportantData: Obtiene info importante desde data de T.get().
** Si se agrega mas info, se debe agrear el atributo correspondiente a Sentence
**************************************************************************/
Sentence.prototype.obtainImportantData = function(data) {
	var dataLength = data.length;
	this.originalText = data[dataLength-1].full_text;
	if(this.finalText === undefined)
		this.finalText = this.originalText;
	this.truncated = data[dataLength-1].truncated;
	if(data[dataLength-1].entities.hasOwnProperty("media"))
  		this.mediaUrl = data[dataLength-1].entities.media[0].media_url;
};


/**************************************************************************
** 2. purifyInitialText: Clean inicial de frases con simbolos o patrones no deseados
** Elimina links, RT, etc.
**************************************************************************/
Sentence.prototype.purifyInitialText = function() {
	//Remover emojis si es requerido
  	if(this.removeEmojis && this.firstIndexOf(this.finalText, pattEmoji) != -1)
  		this.finalText = this.deletePattern(this.finalText, pattEmoji);

  	this.finalText = this.finalText.replace(/#CNNChile|#EnDirecto:|#AhoraNoticias/gi,' #AhoraBoticias ');

  	//Eliminar Links
	this.finalText = this.deletePattern(this.finalText, pattURL);
	
	//Eliminar inicio con RT @XXX:
	this.finalText = this.deletePattern(this.finalText, pattStartWithRT);

	//Eliminar inicio con ???:
	this.finalText = this.deletePattern(this.finalText, pattStartWithInterrogation);

	//Eliminar dobles espacios
	this.finalText = this.deletePattern(this.finalText, pattTwoSpaces);

	this.finalText = this.finalText.trim();
};

/**************************************************************************
** 3. evaluate: Evaluacion de la palabra para determinar si es mejor inicial o final.
** Puntuacion base es de 100.
** Se descuentan puntos si NO cumple con caracteristicas para ser frase inicial. Ademas puede tener bonus por largo, etc.
** Se agregan puntos por si cumple caracteristicas de frase final.
**************************************************************************/
Sentence.prototype.evaluate = function() {
	//Dos Puntos
	var indexOfDosPuntos = this.firstIndexOf(this.finalText, pattDosPuntos);
	if(indexOfDosPuntos == -1){
		this.evaluation = this.evaluation -20;
	}else{
		var countWords = 0;
		var finalTextArray = this.finalText.split(" ");
		for (var i = 0; i < finalTextArray.length; i++){
			countWords++;
			if(finalTextArray[i] == ":"){
				break;
			}
		}
		//Si tiene puntos suma mas por la cantidad de letras antes de los dos puntos.
		if(countWords == 1){
			this.evaluation = this.evaluation -20;
		}else{
			this.evaluation = this.evaluation + indexOfDosPuntos;
			this.indexOfCut = indexOfDosPuntos;
		}
		
	}
	//Puntuacion
	var indexOfPuntuacion = this.firstIndexOf(this.finalText, pattPuntuacion);
	if(indexOfPuntuacion == -1){
		this.evaluation = this.evaluation -20;
	}else{
		//Si tiene puntos suma mas por la cantidad de letras antes de los dos puntos.
		this.evaluation = this.evaluation + indexOfPuntuacion;
		if(this.indexOfCut === undefined)
			this.indexOfCut = indexOfPuntuacion;
	}
	//StartWithOpenPuntuacion
	var indexOfOpenPuntuacion = this.firstIndexOf(this.finalText, pattStartWithOpenPuntuacion);
	if(indexOfOpenPuntuacion == -1){
		this.evaluation = this.evaluation -20;
	}else{
		//NO acumula puntos, pero sirve para indexOF
		this.indexOfCut = this.lastIndexOfMatch(this.finalText, pattEndOpenPuntuacion);
	}

	//Hashtag
	var indexOfHashTag = this.firstIndexOf(this.finalText, pattStartWithHashtag);
	if(indexOfHashTag == -1){
		this.evaluation = this.evaluation -20;
	}
};

/**************************************************************************
** cutToIndexOfCut: Corta el string si tiene indexToCut
**************************************************************************/
Sentence.prototype.cutToIndexOfCut = function(){
	var str = this.finalText;
	var indexToCut = this.indexOfCut;
	if(indexToCut > 0){
		if(this.leftOrRight == 0)
			this.finalText = str.slice(0, indexToCut+1);
		else
			this.finalText = str.slice(indexToCut+2);
	}
};

/**************************************************************************
** [BASE] cutToBaseNumberOfWords: Corta la frase en los 'numberOfWordsBase'
**************************************************************************/
Sentence.prototype.cutToBaseNumberOfWords = function() {
	var number = numberOfWordsBase;
	var str = this.finalText;

	var resultArray = str.split(" ");
	if(resultArray.length > number){
		if(this.leftOrRight == 0)
			resultArray = resultArray.slice(0, number);
		else
			resultArray = resultArray.slice(resultArray.length-number);
	}
	this.finalText = resultArray.join(" ");;
};



/**************************************************************************
********************** PURIFY LEFT AND RIGHT ******************************
**************************************************************************/

/**************************************************************************
** purifyLeft: Logica de limpieza para frase Left.
** IE: no termine en #
**************************************************************************/
Sentence.prototype.purifyLeft = function() {
	//No puede terminar con un #
	this.finalText = this.deletePattern(this.finalText, pattEndHashtag);

	//Debe empezar con mayuscula
	this.firstLetterToUpperOrLowerCase();
};


/**************************************************************************
** purifyRight: Logica de limpieza para frase Right.
** IE: no termine en #
**************************************************************************/
Sentence.prototype.purifyRight = function() {
	//Derecho no puede empezar con Corchetes
	this.finalText = this.deletePattern(this.finalText, pattStartWithCorchetes);

	//Debe empezar con minuscula. (TODO: Evaluar para sustantivos propios)
	this.firstLetterToUpperOrLowerCase();
};



/**************************************************************************
*************************** UTILS *****************************************
**************************************************************************/

/**************************************************************************
** firstIndexOf: Retorna el primer INDICE del patron buscado en la palabra
** Si no encuentra, retorna -1
**************************************************************************/
Sentence.prototype.firstIndexOf = function(str, pattern){
    return str.search(pattern);
};

/**************************************************************************
** lastIndexOfMatch: Retorna el último indice del patron encontrado. Si no encuentra retorna null
**************************************************************************/
Sentence.prototype.lastIndexOfMatch = function(str, pattern){
	pattern.test(str);
	//console.log('pattern.lastIndex:'+pattern.lastIndex);
	return pattern.lastIndex;
};

/**************************************************************************
** firstTextMatch: Retorna el primer STRING del patron buscado en la palabra
**************************************************************************/
Sentence.prototype.firstTextMatch = function(str, pattern){
    return str.match(pattern);
};

/**************************************************************************
** deletePattern: Elimina todo pattern dentro de la palabra. Retorna STRING
**************************************************************************/
Sentence.prototype.deletePattern = function(str, pattern){
	return str.replace(pattern,""); 
};

/**************************************************************************
** removeSingleCharWordAtBegining: elimina la primera palabra si tiene un solo caracter [IE: y, a, e, o, u]
**************************************************************************/
Sentence.prototype.removeSingleCharWordAtBegining = function() {
	var str = this.finalText;
	var strArray = str.split(" ");
	if(strArray[0].length == 1){
		strArray = strArray.slice(1);
		this.finalText = strArray.join(" ");
	}else{
		this.finalText = str;
	}
};

/**************************************************************************
** removeOneWord: elimina una palabra al fin o inicio, segun sea Left o Right, respectivamente
**************************************************************************/
Sentence.prototype.removeOneWord = function() {
	var str = this.finalText;
	var strArray = str.split(" ");

	if(this.leftOrRight == 0){
		strArray = strArray.slice(0, strArray.length-2);
	}else{
		strArray = strArray.slice(1);
	}

	this.finalText = strArray.join(" ");
};

/**************************************************************************
** firstLetterToUpperOrLowerCase: UppperCase a left, LowerCase a rigth
**************************************************************************/
Sentence.prototype.firstLetterToUpperOrLowerCase = function() {
	if(this.leftOrRight == 0 || this.startUpper){
		this.finalText = this.finalText.charAt(0).toUpperCase() + this.finalText.slice(1);
	}else{
		//Si la primera palabra tiene mayuscula y la segunda tambien, quedan ambas en mayusculas
		//De lo contrario, se deja en minuscula
		var sentenceArray = this.finalText.split(" ");
		if(pattStartWithUpper.test(sentenceArray[0]) && pattStartWithUpper.test(sentenceArray[1])){
			this.finalText = this.finalText.charAt(0).toUpperCase() + this.finalText.slice(1);
		}else{
			this.finalText = this.finalText.charAt(0).toLowerCase() + this.finalText.slice(1);
		}
	}
};

 
/**************************************************************************
** checkForAdSentence: elimina una palabra al fin o inicio, segun sea Left o Right, respectivamente
**************************************************************************/
Sentence.prototype.validateSentence = function() {
	if(this.truncated){
		console.log("TRUNCATED. NOT VALID");
		this.validSentence = false;
		return;
	}

	//Buscamos si tiene mas de dos palabras consecutivas en mayusculas
	var sentenceArray = this.finalText.split(" ");
	var strikeOne = false;
	for (var i = 0; i < sentenceArray.length; i++){
	 	if(pattIsUpperCase.test(sentenceArray[i])){
	 		if(!strikeOne){
	 			strikeOne = true;
	 		}else{
	 			console.log("UPPERCASED. NOW VALID ["+this.finalText+"]");
	 		}
	 	}else{
	 		strikeOne = false;
	 	}
	}
};


// export the class
module.exports = Sentence;