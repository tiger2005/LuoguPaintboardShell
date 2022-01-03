function paintPixel(token, x, y, color, cb){
	$.ajax({
		type: "POST",
		url: "https://www.luogu.com.cn/paintboard/paint?token=" + token,
		data: {x: x, y: y, color: color},
		success: function(){
			cb(true);
		},
		error: function(dt){
			cb(false, dt);
		}
	})
}