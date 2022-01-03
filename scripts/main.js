var imageList = (localStorage.getItem("imgList") == undefined) ? [] : JSON.parse(localStorage.getItem("imgList"));
var tokenList = (localStorage.getItem("tokList") == undefined) ? [] : JSON.parse(localStorage.getItem("tokList"));

var actionVerified = false;
var lastActionTime;
var actionCurrentMap, actionCurrentWantedMap, actionTotal, actionCurrentFixed, actionMovement, actionMovementFails;
var actionWaitList, actionRealList;
var actionSleeping = true;
var actionTokenList = new Heap((x, y) => x[1] < y[1]);
var actionInterval;
var actionUKE, actionBroken, actionTooFast, actionChanged;

Date.prototype.pattern = function(format) {
	var date = {
		"y+": this.getYear(),
		"M+": this.getMonth() + 1,
		"d+": this.getDate(),
		"h+": this.getHours(),
		"m+": this.getMinutes(),
		"s+": this.getSeconds(),
		"q+": Math.floor((this.getMonth() + 3) / 3),
		"S+": this.getMilliseconds()
	};
	if (/(y+)/i.test(format)) {
		format = format.replace(RegExp.$1, (this.getFullYear() + '').substr(4 - RegExp.$1.length));
	}
	for (var k in date) {
		if (new RegExp("(" + k + ")").test(format)) {
			format = format.replace(RegExp.$1, RegExp.$1.length == 1
			  ? date[k] : ("00" + date[k]).substr(("" + date[k]).length));
		}
	}
	return format;
}
function logError(x){
	$(".console").append(`<span style='color: red'>| ${new Date().pattern("yy-MM-dd hh:mm:ss")} ! ${x}\n</span>`);
	$(".console").scrollTop($(".console").prop("scrollHeight"));
}
function logSuccess(x){
	$(".console").append(`<span style='color: lime'>| ${new Date().pattern("yy-MM-dd hh:mm:ss")} $ ${x}\n</span>`);
	$(".console").scrollTop($(".console").prop("scrollHeight"));
}
function logInfo(x){
	$(".console").append(`<span style='color: deepskyblue'>| ${new Date().pattern("yy-MM-dd hh:mm:ss")} . ${x}\n</span>`);
	$(".console").scrollTop($(".console").prop("scrollHeight"));
}


function flushAction(){
	if(!actionVerified)
		return;
	$(".actionBlock").html(`<div style='text-align: left; width: 200px'>Total: ${actionTotal}\nMoves: <span style='color: lime'>${actionMovement}</span> | <span style='color: red'>${actionMovementFails}</span>\n<span style='color: red; font-size: 12px'>Fast: ${actionTooFast} | Broken: ${actionBroken}\nChanged: ${actionChanged} | Unknown: ${actionUKE}\n</span>Complete:\n  ${actionCurrentFixed} | ${(actionCurrentFixed / actionTotal * 100).toFixed(2)}%</div>`)
}
function nextPixel(){
	if(actionRealList.length == 0){
		actionRealList = actionWaitList;
		actionWaitList = [];
	}
	while(actionRealList.length != 0
		&& actionCurrentMap[actionRealList[actionRealList.length - 1][0]][actionRealList[actionRealList.length - 1][1]]
		== actionCurrentWantedMap[actionRealList[actionRealList.length - 1][0]][actionRealList[actionRealList.length - 1][1]])
		actionRealList.pop();
	if(actionRealList.length == 0)
		return [-1, -1];
	return actionRealList.pop();
}
function nextToken(){
	if(actionTokenList.top() == null || actionTokenList.top()[1] >= Date.now() - 30 * 1000)
		return ["", -1];
	return actionTokenList.extract();
}
function actionTouch(tm){
	if(!actionSleeping)
		return;
	actionSleeping = false;
	actionInterval = setInterval(function(){
		if(!actionVerified){
			clearTimeout(actionInterval);
			actionSleeping = true;
			return;
		}
		var tk = nextToken();
		if(tk[1] == -1)
			return;
		var px = nextPixel();
		if(px[0] == -1){
			actionTokenList.insert(tk);
			clearTimeout(actionInterval);
			actionSleeping = true;
			return;
		}
		paintPixel(tk[0], px[1], px[0], Number.parseInt(actionCurrentWantedMap[px[0]][px[1]], 32), function(can, dt){
			if(can){
				++ actionMovement;
				tk[1] = Date.now();
			}
			else{
				// load for 5 sec.
				tk[1] = Date.now();
				++ actionMovementFails;
				actionWaitList.push(px);
				dt = dt.responseJSON;
				console.log(dt);
				if(dt.data == "操作过于频繁")
					++ actionTooFast;
				else if(dt.status != 403)
					++ actionUKE;
				else if(dt.data == "Invalid token")
					++ actionChanged;
				else if(dt.data.indexOf("无法参加此活动") != -1)
					++ actionBroken;
				else
					++ actionUKE;
			}
			actionTokenList.insert(tk);
			flushAction();
		});
	}, 50);
}
function mainFunc(tm){
	var boardLoader = function(clr = false){
		if(tm != lastActionTime)
			return;
		logInfo("Fetching board...");
		$.ajax({
			type: "GET",
			url: "https://www.luogu.com.cn/paintboard/board",
			success: function(d){
				if(tm != lastActionTime)
					return;
				d = d.split("\n");
				for(var i=0; i<600; i++)
					for(var j=0; j<1000; j++)
						actionCurrentMap[i][j] = d[j][i];
				actionWaitList = [];
				actionRealList = [];
				actionCurrentFixed = 0;
				for(var p=0; p<600; p++){
					for(var q=0; q<1000; q++) if(actionCurrentWantedMap[p][q] != '-'){
						actionCurrentFixed += (actionCurrentWantedMap[p][q] == actionCurrentMap[p][q]);
						if(actionCurrentWantedMap[p][q] != actionCurrentMap[p][q])
							actionWaitList.push([p, q]);
					}
				}
				logSuccess(`Currently, ${actionCurrentFixed} (${(actionCurrentFixed / actionTotal * 100).toFixed(2)}%) pixel(s) are done.`);
	            if(clr){
					actionTokenList.clear();
					var currTime = Date.now() - 30 * 1000;
					for(var i=0; i<tokenList.length; i++)
						actionTokenList.insert([tokenList[i], currTime]);
	            }
	            flushAction();
				if(actionWaitList.length)
					actionTouch(tm);
			},
			error: function(){
				logError("Cannot fetch board.");
			}
		})
		setTimeout(boardLoader, 10000);
	}
	boardLoader(true);
}
function startAction(){
	lastActionTime = Date.now();
	delete(actionCurrentMap);
	delete(actionCurrentWantedMap);
	actionCurrentMap = [];
	actionCurrentWantedMap = [];
	for(var i=0; i<600; i++){
		var p = [];
		for(var j=0; j<1000; j++)
			p.push("-");
		actionCurrentMap.push(p);
		p = [];
		for(var j=0; j<1000; j++)
			p.push("-");
		actionCurrentWantedMap.push(p);
	}
	actionUKE = actionBroken = actionTooFast = actionChanged = 0;
	setTimeout(function(){
		actionTotal = 0;
		for(var t=0; t<imageList.length; t++) if(imageList[t][4] >= 0 && imageList[t][5] >= 0){
			var Q = imageList[t];
			var pp = 0;
			for(var x=Q[4]; x<Q[4] + Q[1]; x++)
				for(var y=Q[5]; y<Q[5] + Q[2]; y++){
					var ch = Q[3][pp++];
					if(x < 600 && y < 1000 && ch != '-'){
						actionTotal += (actionCurrentWantedMap[x][y] == '-');
						actionCurrentWantedMap[x][y] = ch;
					}
				}
		}
		actionAttack = actionCurrentFixed = actionMovement = actionMovementFails = 0;
		if(actionTotal == 0){
			logError("No pixel to maintain!?");
			return;
		}
		logSuccess(`${actionTotal} pixel(s) to maintain.`);
		mainFunc(lastActionTime);
	}, 500);
}
function endAction(){
	lastActionTime = Date.now();
	$(".actionBlock").html("No action");
}

$("input").keypress(function(event){
	var keynum = (event.keyCode ? event.keyCode : event.which);
	if(keynum == 13){
		var l = $(this).val();
		$(this).val("");
		l = $.trim(l);
		if(l == "")
			return;
		$(".console").append(`| ${new Date().pattern("yy-MM-dd hh:mm:ss")} > ${l}\n`);
		if(l == "minimize")
			win.minimize();
		else if(l == "quit" || l == 'exit')
			win.close();
		else if(l == "cls")
			$(".console").html("");
		else{
			l = l.split(" ");
			var L = [];
			for(var i=0; i<l.length; i++) if(l[i] != "")
				L.push(l[i]);
			l = L;
			if(l[0] == 'trans'){
				if(l.length == 4){
					getImageData(l[1], l[2], l[3], function(can, res){
						if(!can)
							logError("Cannot get image info.");
						else{
							logSuccess(`Image info: ${res}`);
							logSuccess(`Image be like:`)
							var cvs = $("<canvas></canvas>");
							var p = Number(l[2]), q = Number(l[3]), r = 0;
							var cxt = cvs.get(0).getContext("2d");
							cvs.attr("height", 3 * p).attr("width", 3 * q);
							for(var i=0; i<p; i++)
								for(var j=0; j<q; j++){
									var id = Number.parseInt(res[r++], 32);
									cxt.fillStyle = `rgb(${colorList[id][0]}, ${colorList[id][1]}, ${colorList[id][2]})`;
									cxt.fillRect(j * 3, i * 3, 3, 3);
								}
							$(".console").append(cvs);
							$(".console").append("\n");
						}
						$(".console").scrollTop($(".console").prop("scrollHeight"));
					})
				}
				else{
					logError("Command error.");
				}
			}
			else if(l[0] == 'add'){
				if(l.length == 5){
					if(Number(l[2]) * Number(l[3]) != l[4].length)
						logError("Image size error.");
					else{
						imageList.push([l[1], Number(l[2]), Number(l[3]), l[4], -1, -1]);
						localStorage.setItem("imgList", JSON.stringify(imageList));
						logSuccess(`Image info added: #${imageList.length - 1}`);
					}
				}
				else{
					logError("Command error.");
				}
			}
			else if(l[0] == 'delete'){
				if(l.length == 2){
					if(Number(l[1]) < 0 || Number(l[1]) >= imageList.length
						|| Number(l[1]) == null)
						logError("Argument error.");
					else{
						l[1] = Number(l[1]);
						imageList.splice(l[1], 1);
						localStorage.setItem("imgList", JSON.stringify(imageList));
						logSuccess(`Image info deleted: #${l[1]}`);
					}
				}
				else{
					logError("Command error.");
				}
			}
			else if(l[0] == 'list'){
				if(imageList.length == 0)
					logError("You havn't added any image at all.");
				else{
					var res = '';
					var cnt = 0;
					for(var i=0; i<imageList.length; i++){
						var lok = false;
						if(imageList[i][4] < 0 || imageList[i][5] < 0)
							lok = true;
						cnt += !lok;
						var t = `${imageList[i][0]} | H${imageList[i][1]} & W${imageList[i][2]} | ${lok ? 'X' : `O | (${imageList[i][4]}, ${imageList[i][5]})`}`;
						res += `<div style='width: 100%; background: ${lok ? 'darkred' : 'darkgreen'}'><span style='color: white; background: black'>  #${i} </span> ${t}</div>`;
					}
					logInfo(`Total = ${imageList.length} (activate: ${cnt})`);
					$(".console").append(res);
				}
			}
			else if(l[0] == 'location'){
				if(l.length == 4){
					if(Number(l[2]) < -1 || Number(l[3]) < -1 || Number(l[1]) < 0 || Number(l[1]) >= imageList.length
						|| Number(l[1]) == null || Number(l[2]) == null || Number(l[3]) == null)
						logError("Argument error.");
					else{
						l[1] = Number(l[1]); l[2] = Number(l[2]); l[3] = Number(l[3]);
						imageList[l[1]][4] = l[2];
						imageList[l[1]][5] = l[3];
						localStorage.setItem("imgList", JSON.stringify(imageList));
						logSuccess(`Image info modified: #${l[1]}`);
					}
				}
				else{
					logError("Command error.");
				}
			}
			else if(l[0] == 'tokens'){
				if(tokenList.length == 0)
					logError("No token.");
				else{
					logSuccess(`Token List (length = ${tokenList.length}) :`);
					$(".console").append(`${tokenList.join(";")}\n`);
				}
			}
			else if(l[0] == 'set'){
				if(l.length == 2){
					l = l[1].split(";");
					tokenList = [];
					for(var i=0; i<l.length; i++) 
						if($.trim(l[i]) != "")
							tokenList.push($.trim(l[i]));
					localStorage.setItem("tokList", JSON.stringify(tokenList));
					logSuccess(`${tokenList.length} token(s) loaded.`);
				}
				else{
					logError("Command error.");
				}
			}
			else if(l[0] == 'preview'){
				logInfo("Fetching board...");
				$.ajax({
					type: "GET",
					url: "https://www.luogu.com.cn/paintboard/board",
					success: function(d){
						var p = 600, q = 1000, r = 0;
						var cvs = $("<canvas></canvas>");
						var cxt = cvs.get(0).getContext("2d");
						cvs.attr("height", p).attr("width", q);
						cxt.fillStyle = "rgb(127, 127, 127)";
						d = d.split("\n");
						for(var i=0; i<q; i++)
							for(var j=0; j<p; j++){
								var id = Number.parseInt(d[i][j], 32);
								cxt.fillStyle = `rgb(${Math.ceil(colorList[id][0] / 2)}, ${Math.ceil(colorList[id][1] / 2)}, ${Math.ceil(colorList[id][2] / 2)})`;
								cxt.fillRect(i, j, 1, 1);
							}
						for(var t=0; t<imageList.length; t++) if(imageList[t][4] >= 0 && imageList[t][5] >= 0){
							var Q = imageList[t];
							var pp = 0;
							for(var x=Q[4]; x<Q[4] + Q[1]; x++)
								for(var y=Q[5]; y<Q[5] + Q[2]; y++){
									var ch = Q[3][pp++];
									if(x < p && y < q && ch != '-'){
										var id = Number.parseInt(ch, 32);
										cxt.fillStyle = `rgb(${colorList[id][0]}, ${colorList[id][1]}, ${colorList[id][2]})`;
										cxt.fillRect(y, x, 1, 1);
									}
								}
						}
						$(".console").append(cvs);
						$(".console").append("\n");
						$(".console").scrollTop($(".console").prop("scrollHeight"));
					},
					error: function(){
						logError(`Cannot fetch board.`);
					}
				})
			}
			else if(l[0] == 'current'){
				logInfo("Fetching board...");
				$.ajax({
					type: "GET",
					url: "https://www.luogu.com.cn/paintboard/board",
					success: function(d){
						var p = 600, q = 1000, r = 0;
						var cvs = $("<canvas></canvas>");
						var cxt = cvs.get(0).getContext("2d");
						cvs.attr("height", p).attr("width", q);
						d = d.split("\n");
						for(var i=0; i<q; i++)
							for(var j=0; j<p; j++){
								var id = Number.parseInt(d[i][j], 32);
								cxt.fillStyle = `rgb(${colorList[id][0]}, ${colorList[id][1]}, ${colorList[id][2]})`;
								cxt.fillRect(i, j, 1, 1);
							}
						$(".console").append(cvs);
						$(".console").append("\n");
						$(".console").scrollTop($(".console").prop("scrollHeight"));
					},
					error: function(){
						logError(`Cannot fetch board.`);
					}
				})
			}
			else if(l[0] == 'progress'){
				if(!actionVerified){
					logError("Please start an action first.");
					return;
				}
				var p = 600, q = 1000, r = 0;
				var cvs = $("<canvas></canvas>");
				var cxt = cvs.get(0).getContext("2d");
				cvs.attr("height", p).attr("width", q);
				cxt.fillStyle = 'rgb(127, 127, 127)';
				cxt.fillRect(0, 0, q, p);
				for(var i=0; i<q; i++)
					for(var j=0; j<p; j++){
						var id = Number.parseInt(actionCurrentMap[j][i], 32);
						if(actionCurrentWantedMap[j][i] == '-')
							continue;
						cxt.fillStyle = `rgb(${colorList[id][0]}, ${colorList[id][1]}, ${colorList[id][2]})`;
						cxt.fillRect(i, j, 1, 1);
					}
				$(".console").append(cvs);
				$(".console").append("\n");
				$(".console").scrollTop($(".console").prop("scrollHeight"));
			}
			else if(l[0] == 'start'){
				if(actionVerified)
					logError("Action already started.");
				else if(tokenList.length == 0)
					logError("No token.");
				else{
					actionVerified = true;
					startAction();
				}
			}
			else if(l[0] == 'end'){
				if(!actionVerified)
					logError("Action not started yet.");
				else{
					actionVerified = false;
					endAction();
				}
			}
			else
				logError("Command error.");
		}
		$(".console").scrollTop($(".console").prop("scrollHeight"));
	}
})
$("input").focus();


/*
function mainFunc(tm, clr = true){
	logInfo("Connecting ws...");
	actionWs = new WebSocket("wss://ws.luogu.com.cn/ws");
	actionWs.onopen = function(evt){
		logSuccess("Ws linked!");
		logInfo("Fetching board...");
		$.ajax({
			type: "GET",
			url: "https://www.luogu.com.cn/paintboard/board",
			success: function(d){
				d = d.split("\n");
				for(var i=0; i<600; i++)
					for(var j=0; j<1000; j++)
						actionCurrentMap[i][j] = d[j][i];
				actionWaitList = [];
				actionRealList = [];
				actionSleeping = true;
				for(var p=0; p<600; p++){
					for(var q=0; q<1000; q++) if(actionCurrentWantedMap[p][q] != '-'){
						actionCurrentFixed += (actionCurrentWantedMap[p][q] == actionCurrentMap[p][q]);
						if(actionCurrentWantedMap[p][q] != actionCurrentMap[p][q])
							actionWaitList.push([p, q]);
					}
				}
				logSuccess(`Currently, ${actionCurrentFixed} (${(actionCurrentFixed / actionTotal * 100).toFixed(2)}%) pixel(s) are done.`);
				actionVerified = true;
				var message = {
	                "type": "join_channel",
	                "channel": "paintboard",
	                "channel_param": ""
	            };
	            actionWs.send(JSON.stringify(message));
	            if(clr){
					actionTokenList.clear();
					var currTime = Date.now() - 30 * 1000;
					for(var i=0; i<tokenList.length; i++)
						actionTokenList.insert([tokenList[i], currTime]);
	            }
				if(actionWaitList.length)
					actionTouch(tm);
			},
			error: function(){
				logError("Cannot fetch board.");
				actionWs.close();
			}
		})
	}
	actionWs.onmessage = function(evt){
		if(tm != lastActionTime){
			endAction();
			return;
		}
		if(!actionVerified)
			return;
		var data = JSON.parse(evt.data);
		if(data.type === "paintboard_update") {
            updateColor(data.y, data.x, data.color.toString(32), tm);
        } else if(data.type === "result") {
            ;
        }
	}
	actionWs.onerror = function(evt){
		logError("Ws cannot link to server.");
		actionWs.close();
	}
	actionWs.onclose = function(evt){
		logError("Ws closing...");
		if(actionVerified){
			setTimeout(function(){
				logInfo("Trying to reload...");
				startAction(false);
			}, 2000);
		}
	}

}
*/