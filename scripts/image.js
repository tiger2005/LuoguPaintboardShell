function colorDiff(x, y){
	var r = (x[0] + y[0]) / 2;
	var R = x[0] - y[0];
	var G = x[1] - y[1];
	var B = x[2] - y[2];
	return (2 + r / 256) * R * R + 4 * G * G + (2 + (255 - r) / 256) * B * B;
}
function getImageData(url, height, width, cb){
	if(Number(height) <= 0 || Number(width) <= 0 || Number(height) == null || Number(width) == null)
		cb(false, "");
	var cvs = $("<canvas></canvas>");
	cvs.attr("height", height);
	cvs.attr("width", width);
	var cxt = cvs.get(0).getContext("2d");
	var img = new Image();
	img.onload = function(){
		if (img.fileSize > 0 || (img.width > 0 && img.height > 0)){
			cxt.drawImage(img, 0, 0, width, height);
			var dt = cxt.getImageData(0, 0, width, height).data;
			var T = "";
			for(var i=0; i<dt.length; i+=4){
				var R = dt[i], G = dt[i+1], B = dt[i+2];
				var d = dt[i+3] / 255;
				R = 255 - (255 - R) * d;
				G = 255 - (255 - G) * d;
				B = 255 - (255 - B) * d;
				var res = 0, cur = 1e9;
				for(var k=0; k<colorList.length; k++){
					var d = colorDiff([R, G, B], colorList[k]);
					if(d < cur)
						res = k, cur = d;
				}
				T += res.toString(32);
			}
			cb(true, T);
		}
		else
			cb(false, "");
	}
	img.onerror = function(){
		cb(false, "");
	}
	img.src = url;
}