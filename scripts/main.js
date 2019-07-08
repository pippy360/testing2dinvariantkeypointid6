

/*

  #####
 #     # #       ####  #####    ##   #       ####
 #       #      #    # #    #  #  #  #      #
 #  #### #      #    # #####  #    # #       ####
 #     # #      #    # #    # ###### #           #
 #     # #      #    # #    # #    # #      #    #
  #####  ######  ####  #####  #    # ######  ####

*/
const CIRCLE_RADIUS_MULT = 2;
const DELTA_TOTAL = 10;
const POINT_JUMP_VALUE = 1;
const DIRECTION_POINT_COUNT = 400;
const ROTATION_JUMP = .1;
const SKIP_BLUR = true;
const BLUR_RADIUS = 3;
const COLOUR_SPLITS = 256;
const FRAGMENT_CROP_RADIUS_MULT = 2;
const PIXEL_CHANGE_CHECK_LENGTH = 1;
const FIXED_SHAPE_SCALE = 50;
let g_shape = shape1_shape;
var g_initImages = false;

var g_globalState = {
    canvasClickLocation: {x: .5, y: .5},
    inputImage1Mat: null,
    inputImage2Mat: null,
};

var imgw = 400;
var imgh = 400;
var imgsrc = "boo.jpg";
var g_src = imgsrc;
var g_img = new Image();
g_img.src = imgsrc;





function rotatePoint_matrix(degrees, point) {
    rads = degrees  * Math.PI / 180.0; //convert to rads
    sinT = Math.sin(rads);
    cosT = Math.cos(rads);

    rotMat = [[cosT,sinT],[-sinT,cosT]];
    pointMat = [[point[0]], [point[1]]];

    return matrixMultiply(rotMat, pointMat);
}

function applyTransformToPoint_matrix(degrees, normX, point) {
    var ret = point;
    ret = rotatePoint_matrix(degrees, ret);

    ret = [ ret[0]*normX, ret[1] ];

    ret = rotatePoint_matrix(-degrees, ret);
    return ret
}

function applyTransformToAllPoints(tetha, normX, normY, points) {
    var ret = [];

    for (var i = 0; i < points.length; i++){

        newPoint = points[i];
        newPoint = applyTransformToPoint_matrix(tetha, normX, [newPoint[0], newPoint[1]]);
        newPoint = applyTransformToPoint_matrix(tetha+90, normY, [newPoint[0], newPoint[1]]);

        ret.push( [ newPoint[0][0], newPoint[1][0] ] )
    }
    return ret
}

function getAngleForOnePoint_matrix(point) {

    if(point[0] === 0 && point[1] >= 0) {
        return 270;
    } else if(point[0] === 0 && point[1] < 0) {
        return 90;
    }

    const atanVal = Math.atan(point[1]/point[0]);
    let degs = Math.abs(atanVal * 180.0/Math.PI);

    if (point[1] >= 0 && point[0] >= 0) {
        degs = 360 - degs;
    } else if (point[1] < 0 && point[0] >= 0) {
        //degs = degs;
    } else if (point[1] >= 0 && point[0] < 0) {
        degs += 180;
    } else if (point[1] < 0 && point[0] < 0) {
        degs = 180 - degs;
    }

    return degs
}

function getAngleBetweenTwoPoints_matrix(point1, point2) {
    return Math.abs(getAngleForOnePoint_matrix(point1) - getAngleForOnePoint_matrix(point2))
}

function getPixels(image, width, height, rot, scale, scaleRot) {
    var canvas = document.getElementById('imageMods');
    var ctx = canvas.getContext('2d');
    ctx.save();

    ctx.translate(imgw/2, imgh/2);
    ctx.rotate(scaleRot * Math.PI / 180);

    var normX = Math.sqrt(scale);
    var normY = 1.0 / (Math.sqrt(scale));
    ctx.scale(normX, normY);

    ctx.rotate(-scaleRot * Math.PI / 180);
    ctx.translate(-imgw/2, -imgh/2);

    ctx.translate(imgw/2, imgh/2);
    ctx.rotate(rot * Math.PI / 180);
    ctx.translate(-imgw/2, -imgh/2);
    ctx.drawImage(image, 0, 0, imgw, imgh);
    ctx.restore();
    return ctx.getImageData(0, 0, width, height).data;
}

function toBlackAndWhite(imageData) {
    var output = []

    for (i = 0; i < imgh; i++) {
        var arr = []
        for (j = 0; j < imgw; j++) {
            var index = ( i * (imgw * 4) ) + (j * 4)
            var val = ((imageData[index] + imageData[index+1] + imageData[index+2])/3.0)
            arr.push(val)
        }
        output.push(arr)
    }
    return output
}

function getAverageValueOf5(zvals, i, length) {
    var distvals = [];
    for (var k = 0; k < length; k++) {
            distvals.push(zvals[i+k].z);
    }
    const average = arr => arr.reduce( ( p, c ) => p + c, 0 ) / arr.length;
    return average(distvals);
}

function findRightPointOfAnchor(output) {
    for (let i = 0; i < output.length - (PIXEL_CHANGE_CHECK_LENGTH*2); i++) {
        if( Math.abs( getAverageValueOf5(output, i, PIXEL_CHANGE_CHECK_LENGTH) - getAverageValueOf5(output, i+PIXEL_CHANGE_CHECK_LENGTH, PIXEL_CHANGE_CHECK_LENGTH) )  > DELTA_TOTAL) {
            return i;
        }
    }
}

function getDirectionPointsWithjump(xval, yval, xjump, yjump) {
    var dx = xval;
    var dy = yval;
    var output = [];
    var count = 0;
    while(dx < imgw && dx > 0 && dy < imgh && dy > 0) {
        if (count > DIRECTION_POINT_COUNT) {
            break;
        }
        output.push({x: dx, y: dy});
        count++;
        dx = dx + xjump;
        dy = dy + yjump;
    }
    return output;
}

function to_matrix_shape(shape) {
    var ret = [];
    for (let i = 0; i < shape.length; i++) {
        ret.push([shape[i].x, shape[i].y]);
    }
    return ret;
}

function getDirectionPoints(xval, yval, rot) {
    var jumpH = POINT_JUMP_VALUE;
    var cosval = getCosFromDegrees(rot);
    var sinval = getSinFromDegrees(rot);
    return getDirectionPointsWithjump(
        xval + cosval, yval + sinval, cosval*jumpH, sinval*jumpH)
}

function getZValues(image, xval, yval, rot) {
    var points = getDirectionPoints(xval, yval, rot);
    var ret = [];
    for (var i = 0; i < points.length; i++) {
        ret.push( {
            x: points[i].x,
            y: points[i].y,
            z: bilinearInterp(image, points[i].x, points[i].y)
        } );
    }
    return ret;
}

function canvasTransform(ctx, mat) {
    ctx.transform(mat[0][0], mat[1][0], mat[0][1], mat[1][1], mat[0][2], mat[1][2]);
}

function getHitPoints(img, imageData, clickedPoint) {
    const m_xval = clickedPoint[0];
    const m_yval = clickedPoint[1];
    var blackandwhite = toBlackAndWhite(imageData);
    var rot = 0;
    var shape = [];
    var queue = [];
    for (let rot = 0, i = 0; rot < 360; rot += ROTATION_JUMP) {

        var zvals = getZValues(blackandwhite, m_xval, m_yval, rot);
        var distvals = [];
        for (var k = 0; k < 1; k++) {
            var d__ = findRightPointOfAnchor(zvals, DELTA_TOTAL + (k*3));
            if (d__ != undefined)
                distvals.push(d__);
        }
        const average = arr => arr.reduce( ( p, c ) => p + c, 0 ) / arr.length;

        var dist = parseInt(average(distvals));
        if (dist == undefined)
            continue;

        queue.push(dist)

        const currPoint = zvals[parseInt(average(queue))];
        shape.push([currPoint.x, currPoint.y]);

        if (queue.length > 1)//smooth it
            queue.shift();
    }
    return shape;
}

function applyTransformationMatrixToPoint(point, mat) {
    var resPoint = matrixMultiply( mat, [[point[0]], [point[1]], [1]]);
    return [ resPoint[0][0], resPoint[1][0] ];
}

function applyTransformationMatrixToAllPoints(points, mat) {
    var result = []
    for (var i = 0; i < points.length; i++)
        result.push_back(applyTransformationMatrixToPoint(points[i]))
    return result;
}

function getTransformationMatrixFromScale(scale, rotation, imgw, imgh) {
    var mat = getTranslateMatrix(imgw/2, imgh/2);
    mat = matrixMultiply(mat, getRotationMatrix(rotation));
    mat = matrixMultiply(mat, getNormScaleMatrix(scale));
    mat = matrixMultiply(mat, getRotationMatrix(-rotation));
    mat = matrixMultiply(mat, getTranslateMatrix(-imgw/2, -imgh/2));
    return mat;
}

function getTransformedPoint(point, mat, invMat) {
    const t = applyTransformationMatrixToPoint(point, invMat);
    return applyTransformationMatrixToPoint(t, mat);
}

function applyTransformationMatrixToPoint_m(point, mat) {
    var resPoint = matrixMultiply( mat, [[point[0]], [point[1]], [1]]);
    return [ resPoint[0][0], resPoint[1][0] ]
}

function applyTransformationMatrixToAllKeypoints(keypoints, transformationMat) {
    var ret = [];
    for (var i = 0; i < keypoints.length; i++) {
        var transformedKeypoint = applyTransformationMatrixToPoint_m(keypoints[i], transformationMat);
        ret.push(transformedKeypoint);
    }
    return ret;
}

function getAreaDiff(X) {
    let angle = X[0] % 360;
    //transform the shape, calc the diff
    let shape = applyTransformationMatrixToAllKeypoints(g_shape, getRotationMatrix(angle));

    var cPoint = findCentroid(shape);
    var topHalfBottomHalf = splitShapeHorz_m(shape, cPoint);
    var topHalf = topHalfBottomHalf[0];
    var rightHalfLeftHalf = splitShapeVert_m(topHalf, cPoint);
    var topRight = rightHalfLeftHalf[0];
    var topLeft = rightHalfLeftHalf[1];
    return Math.abs(calcPolygonArea(topRight) - calcPolygonArea(topLeft));
}

function getLowestInRange(shape) {
    var cPoint = findCentroid(shape);
    shape = applyTransformationMatrixToAllKeypoints(shape, getTranslateMatrix(-cPoint[0], -cPoint[1]));
    g_shape = shape;

    //update the point to 0,0 we can remove this line
    cPoint = findCentroid(shape);

    let solution = nelderMead(getAreaDiff, [30]);
    shape = applyTransformationMatrixToAllKeypoints(shape, getRotationMatrix(solution.x[0]));
    var topHalfBottomHalf = splitShapeHorz_m(shape, cPoint);
    var topHalf = topHalfBottomHalf[0];
    var bottomHalf = topHalfBottomHalf[1];
    var rightLeftHalf = splitShapeVert_m(shape, cPoint);
    var right = rightLeftHalf[0];
    var left = rightLeftHalf[1];
    var rightC = findCentroid(right);
    var leftC = findCentroid(left);
    var topC = findCentroid(topHalf);
    var bottomC = findCentroid(bottomHalf);
    var leftAvg = (Math.abs(topC[1]) + Math.abs(bottomC[1]))
    var topAvg = (Math.abs(leftC[0]) + Math.abs(rightC[0]))
    var scaleAvg = (leftAvg/topAvg);
    console.log(scaleAvg);
    return [solution.x[0], scaleAvg, (leftAvg+topAvg)/2];
}

function getShapeFixingTransformationMatrix(shape) {
    if (findCentroid(shape)[0] > 1 || findCentroid(shape)[1] > 1) {
        console.log("invalid shape");
        return null;
    }
    const normVals2 = getLowestInRange(shape);
    let withoutScaleFixMat = getImgmat(normVals2[0], normVals2[1]);
    let fixedShape = applyTransformationMatrixToAllKeypoints(shape, withoutScaleFixMat);
    let globalRadius = getTheRadius(fixedShape, [0,0]);
    let _scaleMatrix = getScaleMatrix(FIXED_SHAPE_SCALE/globalRadius, FIXED_SHAPE_SCALE/globalRadius);
    let withScaleFixMat = matrixMultiply(_scaleMatrix, withoutScaleFixMat);
    // let shapeWithScaleFix = applyTransformationMatrixToAllKeypoints(fixedShape, scaleMatrix);
    return {
        scaleFixMat: withScaleFixMat,
        nonScaledFixedMat: withoutScaleFixMat,
        // shapeScaledFixedMat: withScaleFix,
        scaleDirection: normVals2[0],
        scale: normVals2[1],
        globalRadius: globalRadius,
    }
}

function applyFixToShape(imghitpoints, mat) {
    return applyTransformationMatrixToAllKeypoints(imghitpoints, mat);
}

function getmat(scaleRotation2, scale2) {
    var mat2 = getTranslateMatrix(-imgw / 2, -imgh / 2);
    mat2 = matrixMultiply(mat2, getRotationMatrix(scaleRotation2));
    mat2 = matrixMultiply(mat2, getScaleMatrix(Math.sqrt(scale2), 1.0 / Math.sqrt(scale2)));
    mat2 = matrixMultiply(mat2, getRotationMatrix(-scaleRotation2));
    mat2 = matrixMultiply(mat2, getTranslateMatrix(imgw / 2, imgh / 2));
    return mat2;
}

function getImgmat_c(scaleRotation2, scale2, rotPoint, newcpoint) {
    //Note: the order of transformations is backwards
    var mat2 = getIdentityMatrix();
    mat2 = matrixMultiply(mat2, getTranslateMatrix(200, 200));
    mat2 = matrixMultiply(mat2, getRotationMatrix(-scaleRotation2));
    mat2 = matrixMultiply(mat2, getScaleMatrix(Math.sqrt(scale2), 1.0 / Math.sqrt(scale2)));
    mat2 = matrixMultiply(mat2, getRotationMatrix(scaleRotation2));
    mat2 = matrixMultiply(mat2, getTranslateMatrix(-rotPoint[0], -rotPoint[1]));

    return mat2;
}

function getImgmat(scaleRotation2, scale2, rotPoint) {
    rotPoint = (rotPoint == undefined)? [0,0] : rotPoint;
    var mat2 = getIdentityMatrix();
    mat2 = matrixMultiply(mat2, getTranslateMatrix(rotPoint[0], rotPoint[1]));
    mat2 = matrixMultiply(mat2, getRotationMatrix(-scaleRotation2));
    mat2 = matrixMultiply(mat2, getScaleMatrix(Math.sqrt(scale2), 1.0 / Math.sqrt(scale2)));
    mat2 = matrixMultiply(mat2, getRotationMatrix(scaleRotation2));
    mat2 = matrixMultiply(mat2, getTranslateMatrix(-rotPoint[0], -rotPoint[1]));

    return mat2;
}

function getPixel(imgData, index) {
    var i = index*4, d = imgData.data;
    return [d[i],d[i+1],d[i+2],d[i+3]] // returns array [R,G,B,A]
}

// AND/OR



function drawPoints_m(ctx, points, colour, width) {
    for (let i = 0; i < points.length; i++) {
        drawPoint_m(ctx, points[i], colour, width)
    }
}

function drawCanvasMiddleLines(ctx) {
    let height = ctx.canvas.height;
    let width = ctx.canvas.width;
    drawline_m(ctx, [[width/2, 0], [width/2, height]]);
    drawline_m(ctx, [[0, height/2], [width, height/2]]);
    //FIXME: we need to transform the cirlces so that they're scewed
}

function getTheRadius(fixedHitPoints, cPoint) {
    const rightHalfLeftHalf = splitShapeVert_m(fixedHitPoints, cPoint);
    const topRightPoint = findCentroid(rightHalfLeftHalf[0]);
    return Math.abs(topRightPoint[0] - cPoint[0]) * CIRCLE_RADIUS_MULT;
}

function drawCenterOfGravityHalfPoints(ctx, fixedHitPoints, cPoint) {
    cPoint = (cPoint == undefined)? [0,0] : cPoint;

    const topHalfBottomHalf = splitShapeHorz_m(fixedHitPoints, cPoint);
    const topHalfPoint = findCentroid(topHalfBottomHalf[0]);
    const rightHalfLeftHalf = splitShapeVert_m(fixedHitPoints, cPoint);
    const topRightPoint = findCentroid(rightHalfLeftHalf[0]);
    drawPoints_m(ctx, [topHalfPoint, topRightPoint], "green");
}

function paintuiresult(cPoint, fixMat, resHitPoints, c_result, image)
{
    var imgmat = getIdentityMatrix();
    imgmat = matrixMultiply(getTranslateMatrix(-cPoint[0], -cPoint[1]), imgmat);
    imgmat = matrixMultiply(fixMat, imgmat);
    imgmat = matrixMultiply(getTranslateMatrix(200, 200), imgmat);
    drawImageWithTransformations(c_result.ctx, image, imgmat);

    drawPoint_m(c_result.ctx_ui, [200, 200], "blue");
    drawPoints_m(c_result.ctx_ui, resHitPoints, "red");

    drawCanvasMiddleLines(c_result.ctx_ui);
}

function drawTransformedCircle(canvasObj, mat, radius, colour) {
    colour = (colour == undefined)? 'blue' : colour;
    canvasObj.ctx_ui.save();
    canvasTransform(canvasObj.ctx_ui, mat);
    drawCircle(canvasObj.ctx_ui, [0,0], radius, colour);
    canvasObj.ctx_ui.restore();
}

function drawAltCircle(hitPoints1Obj, hitPoints2Obj, image1ZeroPointFixMat, image2ZeroPointFixMat) {
    const c_imageNoChanges = getCanvas("imageNoChanges");
    const c_inputImage1 = getCanvas("inputImage1");
    const c_inputImage2 = getCanvas("inputImage2");
    const c_preppedImage1 = getCanvas("preppedImage1");
    const c_preppedImage2 = getCanvas("preppedImage2");
    const c_resultImage1 = getCanvas("imageResult1");
    const c_resultImage2 = getCanvas("imageResult2");

    // let r1 = getTheRadius(hitPoints1Obj.hitpoints_c, hitPoints1Obj.centroid);
    // let invMat = getIdentityMatrix();
    // invMat = matrixMultiply(image1ZeroPointFixMat, invMat);
    // invMat = matrixMultiply(getTranslateMatrix(cPoint[0], cPoint[1]), invMat);

    let radius = FIXED_SHAPE_SCALE*CIRCLE_RADIUS_MULT;
    drawTransformedCircle(c_resultImage1, getTranslateMatrix(200, 200), radius);
    drawTransformedCircle(c_resultImage2, getTranslateMatrix(200, 200), radius);

    drawPoint_m(c_resultImage1.ctx, [200, 200+FIXED_SHAPE_SCALE]);
    drawPoint_m(c_resultImage1.ctx, [200+FIXED_SHAPE_SCALE, 200]);

    drawPoint_m(c_resultImage2.ctx, [200, 200+FIXED_SHAPE_SCALE]);
    drawPoint_m(c_resultImage2.ctx, [200+FIXED_SHAPE_SCALE, 200]);

    const pt1 = matrixMultiply(getTranslateMatrix_point(hitPoints1Obj.centroid), math.inv(image1ZeroPointFixMat));
    const pt2 = matrixMultiply(getTranslateMatrix_point(hitPoints2Obj.centroid), math.inv(image2ZeroPointFixMat));
    drawTransformedCircle(c_preppedImage1, pt1, radius);
    drawTransformedCircle(c_preppedImage2, pt2, radius);

    drawTransformedCircle(c_inputImage1, pt1, radius);
    drawTransformedCircle(c_inputImage2, pt2, radius);

    const org_t1 = matrixMultiply(math.inv(g_globalState.inputImage1Mat), pt1);
    const org_t2 = matrixMultiply(math.inv(g_globalState.inputImage2Mat), pt2);
    drawTransformedCircle(c_imageNoChanges, org_t1, radius);
    drawTransformedCircle(c_imageNoChanges, org_t2, radius, 'green');

    const inputImg_t1 = matrixMultiply(g_globalState.inputImage2Mat, org_t1);
    const inputImg_t2 = matrixMultiply(g_globalState.inputImage1Mat, org_t2);
    drawTransformedCircle(c_inputImage2, inputImg_t1, radius, 'green');
    drawTransformedCircle(c_inputImage1, inputImg_t2, radius, 'green');

    drawTransformedCircle(c_preppedImage2, inputImg_t1, radius, 'green');
    drawTransformedCircle(c_preppedImage1, inputImg_t2, radius, 'green');

    let invres_t1 = matrixMultiply(getTranslateMatrix_point(hitPoints2Obj.centroid, -1), inputImg_t1);
    invres_t1 = matrixMultiply(image2ZeroPointFixMat, invres_t1);
    invres_t1 = matrixMultiply(getTranslateMatrix(200, 200), invres_t1);
    let invres_t2 = matrixMultiply(getTranslateMatrix_point(hitPoints1Obj.centroid, -1), inputImg_t2);
    invres_t2 = matrixMultiply(image1ZeroPointFixMat, invres_t2);
    invres_t2 = matrixMultiply(getTranslateMatrix(200, 200), invres_t2);

    drawTransformedCircle(c_resultImage2, invres_t1, radius, 'green');
    drawLineWithTransformation(c_resultImage2, [[0,0], [0,200]], invres_t1, 'green');
    drawLineWithTransformation(c_resultImage2, [[0,0], [200,0]], invres_t1, 'green');
    drawLineWithTransformation(c_resultImage2, [[0,0], [0,1000]], getTranslateMatrix(200, 0), 'black');
    drawLineWithTransformation(c_resultImage2, [[0,0], [1000,0]], getTranslateMatrix(0, 200), 'black');

    drawTransformedCircle(c_resultImage1, invres_t2, radius, 'green');
    drawLineWithTransformation(c_resultImage1, [[0,0], [0,200]], invres_t2, 'green');
    drawLineWithTransformation(c_resultImage1, [[0,0], [200,0]], invres_t2, 'green');
    drawLineWithTransformation(c_resultImage1, [[0,0], [0,1000]], getTranslateMatrix(200, 0), 'black');
    drawLineWithTransformation(c_resultImage1, [[0,0], [1000,0]], getTranslateMatrix(0, 200), 'black');

    drawSquareWithTransformation(c_resultImage1, [200,200], radius, getIdentityMatrix(), 'red')
    drawSquareWithTransformation(c_resultImage2, [0,0], radius, invres_t1, 'green')
    drawSquareWithTransformation(c_resultImage2, [200,200], radius, getIdentityMatrix(), 'red')
    drawSquareWithTransformation(c_resultImage1, [0,0], radius, invres_t2, 'green')
}

function changeImgSrc(newSrc) {
    g_initImages = false;
    g_src = newSrc;
    g_img.src = newSrc;
    draw();
}

const shapes = [
    square_shape,
    square_shape2,
    triangle_shape,
    shape1_shape
];

function changeShape(index) {
    g_shape = shapes[index];
    draw();
}

function getIdentityMatrix() {
    return [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ];
}

var TARGET_TRIANGLE_SCALE = {x: 100, y: 100};
function getTargetTriangle() {
    var targetTriangle = [
        {x: 0, y: 0},
        {x: .5 * TARGET_TRIANGLE_SCALE.x, y: 1 * TARGET_TRIANGLE_SCALE.y},
        {x: 1 * TARGET_TRIANGLE_SCALE.x, y: 0}
    ];
    return targetTriangle;
}

function drawfrag(ctx, img, imgmat) {
    let matfrag1 = getIdentityMatrix();
    // matfrag1 = matrixMultiply(getTranslateMatrix(-16, -16), matfrag1);
    matfrag1 = matrixMultiply(imgmat, matfrag1);
    // matfrag1 = matrixMultiply(getTranslateMatrix(16, 16), matfrag1);

    ctx.imageSmoothingEnabled = true;
    ctx.webkitImageSmoothingEnabled = true;
    ctx.mozImageSmoothingEnabled = true;

    ctx.save();
    canvasTransform(ctx, matfrag1);
    ctx.drawImage(img, 0, 0, 400, 400);
    ctx.restore();
}

function prepImage(ctx)
{
    var t = document.getElementById("tempCanvas");

    if (!SKIP_BLUR) {
        processImage(ctx.canvas, "tempCanvas", BLUR_RADIUS, false);
        ctx = t.getContext("2d");
    }

    var imageOut = new MarvinImage(400, 400);
    var imagein = new MarvinImage(400, 400);
    imagein.imageData = ctx.getImageData(0, 0, 400, 400);
    Marvin.prewitt(imagein, imageOut);
    Marvin.invertColors(imageOut, imageOut);
    Marvin.thresholding(imageOut, imageOut, 150);
    imageOut.draw(t);

    let data_ = document.getElementById("tempCanvas").getContext("2d").getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    let data = data_.data;
    let splits = COLOUR_SPLITS;
    for (let i = 0; i < data.length; i+=4) {
        var val = ((data[i] + data[i+1] + data[i+2])/3.0);
        val = Math.floor(val/(256/splits)) * (256/splits);
        data[i]   = val;
        data[i+1] = val;
        data[i+2] = val;
        data[i+3] = 255;
    }
    return data_;
}

function _getCanvas(id, cleanBase, cleanUI) {
    let c = document.getElementById(id);
    let ctx = c.getContext("2d");
    if (cleanBase)
        ctx.clearRect(0, 0, c.width, c.height);
    let c_ui = document.getElementById(id + "_ui");
    let ctx_ui = c_ui.getContext("2d");
    if (cleanUI)
        ctx_ui.clearRect(0, 0, c.width, c.height);
    return {
        c: c,
        ctx: ctx,
        c_ui: c_ui,
        ctx_ui: ctx_ui,
    }
}

function getCanvas(id) {
    return _getCanvas(id, false, false)
}

function getCleanUICanvas(id) {
    return _getCanvas(id, false, true)
}

function getCleanCanvas(id) {
    return _getCanvas(id, true, true)
}

function getImageData(cleanCanvasObj) {
    return cleanCanvasObj.ctx.getImageData(0, 0, cleanCanvasObj.c.width, cleanCanvasObj.c.height).data
}

function initImages() {
    const scale1 = 3;
    const scaleRotation1 = 90.0;

    const scale2 = 1.8;
    const scaleRotation2 = -45.0;

    const mat1 = g_transformState.appliedTransformationsMat;
    getImgmat(scaleRotation1, scale1, [200, 200]);

    g_globalState.inputImage1Mat = mat1;

    let mat2 = getIdentityMatrix();
    mat2 = matrixMultiply(mat2, getTranslateMatrix(200, 200));
    mat2 = matrixMultiply(mat2, getRotationMatrix(72));
    mat2 = matrixMultiply(mat2, getScaleMatrix(.9, 1));

    mat2 = matrixMultiply(mat2, getRotationMatrix(-scaleRotation2));
    mat2 = matrixMultiply(mat2, getScaleMatrix(Math.sqrt(scale2), 1.0 / Math.sqrt(scale2)));
    mat2 = matrixMultiply(mat2, getRotationMatrix(scaleRotation2));
    mat2 = matrixMultiply(mat2, getTranslateMatrix(-200, -200));


    g_globalState.inputImage2Mat = mat2;

    const c_imageNoChanges = getCleanCanvas("imageNoChanges");
    drawImageWithTransformations(c_imageNoChanges.ctx, g_img, getIdentityMatrix());

    const c_inputImage1 = getCleanCanvas("inputImage1");
    const c_inputImage2 = getCleanCanvas("inputImage2");

    drawImageWithTransformations(c_inputImage1.ctx, g_img, mat1);
    drawImageWithTransformations(c_inputImage2.ctx, g_img, mat2);

    const c_preppedImage1 = getCleanCanvas("preppedImage1");
    const c_preppedImage2 = getCleanCanvas("preppedImage2");
    {
        const preppedImage1 = prepImage(c_inputImage1.ctx);
        const preppedImage2 = prepImage(c_inputImage2.ctx);

        drawImageWithTransformations_put(c_preppedImage1.ctx, preppedImage1, mat1);
        drawImageWithTransformations_put(c_preppedImage2.ctx, preppedImage2, mat2);
    }
}

function getHitPointsWithCanvas(preppedImageCanvasObj, clickedPoint) {
    const preppedImageData = getImageData(preppedImageCanvasObj);
    return getHitPoints(preppedImageCanvasObj.c, preppedImageData, clickedPoint);
}

function getCenteredHitPointsWithCanvas(preppedImageCanvasObj, clickedPoint) {
    const hitPoints = getHitPointsWithCanvas(preppedImageCanvasObj, clickedPoint);
    const hitPoints_centroid = findCentroid(hitPoints);
    const tranmat = getTranslateMatrix(-hitPoints_centroid[0], -hitPoints_centroid[1]);
    return {
        hitpoints_c: applyTransformationMatrixToAllKeypoints(hitPoints, tranmat),
        centroid: hitPoints_centroid
    };
}

function getImage1HitPoints(clickedPoint) {
    const c_preppedImage1 = getCanvas("preppedImage1");
    return getCenteredHitPointsWithCanvas(c_preppedImage1, clickedPoint);
}

function getImage2HitPoints(clickedPoint) {
    const c_preppedImage2 = getCanvas("preppedImage2");
    return getCenteredHitPointsWithCanvas(c_preppedImage2, clickedPoint);
}

function getRotationFixHack(hitPoints1Obj, hitPoints2Obj, image1ZeroPointFixMat_withoutRotationFix, image2ZeroPointFixMat) {

    const pt2 = matrixMultiply(getTranslateMatrix_point(hitPoints2Obj.centroid), math.inv(image2ZeroPointFixMat));
    const org_t2 = matrixMultiply(math.inv(g_globalState.inputImage2Mat), pt2);
    const inputImg_t2 = matrixMultiply(g_globalState.inputImage1Mat, org_t2);
    let invres_t2 = matrixMultiply(getTranslateMatrix_point(hitPoints1Obj.centroid, -1), inputImg_t2);
    invres_t2 = matrixMultiply(image1ZeroPointFixMat_withoutRotationFix, invres_t2);
    const rotPt1 = applyTransformationMatrixToPoint_m([100, 0], invres_t2);
    const rotPt_zero = applyTransformationMatrixToPoint_m([0, 0], invres_t2);
    const diffY = (rotPt1[1] - rotPt_zero[1]);
    const diffX = (rotPt1[0] - rotPt_zero[0]);
    const ratio = diffY/diffX;
    const angle = Math.atan(ratio)*180.0/Math.PI;
    return matrixMultiply(getRotationMatrix(-Math.round(angle)), image1ZeroPointFixMat_withoutRotationFix);
}

function getRotationHack(imgmat2) {
    return imgmat2;
}

function g_getClickedPoint() {
    const clicked_x = Math.round( g_globalState.canvasClickLocation.x*imgw );
    const clicked_y = Math.round( g_globalState.canvasClickLocation.y*imgh );
    const _clickedPoint = [clicked_x, clicked_y];
    const inputImage1ClickedPoint = applyTransformationMatrixToPoint_m(_clickedPoint, g_globalState.inputImage1Mat);
    const inputImage2ClickedPoint = applyTransformationMatrixToPoint_m(_clickedPoint, g_globalState.inputImage2Mat);

    return {
        orgImage: _clickedPoint,
        inputImage1: inputImage1ClickedPoint,
        inputImage2: inputImage2ClickedPoint,
    };
}

function drawResultImages(hitPoints1Obj, hitPoints2Obj, image1ZeroPointFixMat, image2ZeroPointFixMat) {
    const c_inputImage1 = getCanvas("inputImage1");
    const c_inputImage2 = getCanvas("inputImage2");
    const c_resultImage1 = getCanvas("imageResult1");
    const c_resultImage2 = getCanvas("imageResult2");

    let image1Mat = getIdentityMatrix();
    image1Mat = matrixMultiply(getTranslateMatrix(-hitPoints1Obj.centroid[0], -hitPoints1Obj.centroid[1]), image1Mat);
    image1Mat = matrixMultiply(image1ZeroPointFixMat, image1Mat);
    image1Mat = matrixMultiply(getTranslateMatrix(200, 200), image1Mat);
    drawImageWithTransformations(c_resultImage1.ctx, c_inputImage1.c, image1Mat);

    let image2Mat = getIdentityMatrix();
    image2Mat = matrixMultiply(getTranslateMatrix(-hitPoints2Obj.centroid[0], -hitPoints2Obj.centroid[1]), image2Mat);
    image2Mat = matrixMultiply(image2ZeroPointFixMat, image2Mat);
    image2Mat = matrixMultiply(getTranslateMatrix(200, 200), image2Mat);
    drawImageWithTransformations(c_resultImage2.ctx, c_inputImage2.c, image2Mat);
}

function drawFragments(hitPoints1Obj, hitPoints2Obj, image1ZeroPointFixMat, image2ZeroPointFixMat) {
    const c_inputImage1 = getCanvas("inputImage1");
    const c_inputImage2 = getCanvas("inputImage2");
    const c_fragment1 = getCleanCanvas("drawFragment1");
    const c_fragment2 = getCleanCanvas("drawFragment2");

    let radius = FIXED_SHAPE_SCALE*CIRCLE_RADIUS_MULT;
    let scale = (16/radius);

    let image1Mat = getIdentityMatrix();
    image1Mat = matrixMultiply(getTranslateMatrix(-hitPoints1Obj.centroid[0], -hitPoints1Obj.centroid[1]), image1Mat);
    image1Mat = matrixMultiply(image1ZeroPointFixMat, image1Mat);
    image1Mat = matrixMultiply(getScaleMatrix(scale, scale), image1Mat);
    image1Mat = matrixMultiply(getTranslateMatrix(16, 16), image1Mat);
    drawfrag(c_fragment1.ctx, c_inputImage1.c, image1Mat, 0);

    let image2Mat = getIdentityMatrix();
    image2Mat = matrixMultiply(getTranslateMatrix(-hitPoints2Obj.centroid[0], -hitPoints2Obj.centroid[1]), image2Mat);
    image2Mat = matrixMultiply(image2ZeroPointFixMat, image2Mat);
    image2Mat = matrixMultiply(getScaleMatrix(scale, scale), image2Mat);
    image2Mat = matrixMultiply(getTranslateMatrix(16, 16), image2Mat);
    drawfrag(c_fragment2.ctx, c_inputImage2.c, image2Mat, 0);

    const dist = distance(pHash(c_fragment2.c), pHash(c_fragment1.c));
    $("#hashDistance").html("" + dist);
}

function drawUIElements(hitPoints1Obj, hitPoints2Obj, image1ZeroPointFixMat, image2ZeroPointFixMat) {
    const c_imageNoChanges = getCanvas("imageNoChanges");
    const c_inputImage1 = getCanvas("inputImage1");
    const c_inputImage2 = getCanvas("inputImage2");
    const c_preppedImage1 = getCanvas("preppedImage1");
    const c_preppedImage2 = getCanvas("preppedImage2");
    const c_resultImage1 = getCanvas("imageResult1");
    const c_resultImage2 = getCanvas("imageResult2");
    const clickedPoint = g_getClickedPoint();

    drawPoint_m(c_imageNoChanges.ctx_ui, clickedPoint.orgImage, "blue", 5);

    drawPoint_m(c_inputImage1.ctx_ui, clickedPoint.inputImage1, "blue", 5);
    drawPoint_m(c_inputImage2.ctx_ui, clickedPoint.inputImage2, "blue", 5);

    let t1 = getTranslateMatrix(hitPoints1Obj.centroid[0], hitPoints1Obj.centroid[1]);
    let h1 = applyTransformationMatrixToAllKeypoints(hitPoints1Obj.hitpoints_c, t1);
    drawPoints_m(c_preppedImage1.ctx_ui, h1, "red", 1);
    drawPoint_m(c_preppedImage1.ctx_ui, clickedPoint.inputImage1, "blue", 5);

    let t2 = getTranslateMatrix(hitPoints2Obj.centroid[0], hitPoints2Obj.centroid[1]);
    let h2 = applyTransformationMatrixToAllKeypoints(hitPoints2Obj.hitpoints_c, t2);
    drawPoints_m(c_preppedImage2.ctx_ui, h2, "red", 1);
    drawPoint_m(c_preppedImage2.ctx_ui, clickedPoint.inputImage2, "blue", 5);

    let c_mat = getTranslateMatrix(200, 200);

    let r1 = applyTransformationMatrixToAllKeypoints(hitPoints1Obj.hitpoints_c, matrixMultiply(c_mat, image1ZeroPointFixMat));
    drawPoints_m(c_resultImage1.ctx_ui, r1, "red", 1);
    drawPoint_m(c_resultImage1.ctx_ui, [200,200], "blue", 5);

    let r2 = applyTransformationMatrixToAllKeypoints(hitPoints2Obj.hitpoints_c, matrixMultiply(c_mat, image2ZeroPointFixMat));
    drawPoints_m(c_resultImage2.ctx_ui, r2, "red", 1);
    drawPoint_m(c_resultImage2.ctx_ui, [200,200], "blue", 5);

    const c_shapePreppedImage1 = getCanvas("shapePreppedImage1");
    const c_shapePreppedImage2 = getCanvas("shapePreppedImage2");
    const c_shapeResult1 = getCanvas("shapeResult1");
    const c_shapeResult2 = getCanvas("shapeResult2");

    let c1 = getTranslateMatrix(hitPoints1Obj.centroid[0], hitPoints1Obj.centroid[1]);
    drawPolyFull(c_shapePreppedImage1.ctx_ui, applyTransformationMatrixToAllKeypoints(hitPoints1Obj.hitpoints_c, c1));
    let c2 = getTranslateMatrix(hitPoints2Obj.centroid[0], hitPoints2Obj.centroid[1]);
    drawPolyFull(c_shapePreppedImage2.ctx_ui, applyTransformationMatrixToAllKeypoints(hitPoints2Obj.hitpoints_c, c2));

    drawPolyFull(c_shapeResult1.ctx_ui, r1);

    drawPolyFull(c_shapeResult2.ctx_ui, r2);

    c_shapeResult2.ctx_ui.globalAlpha = 0.4;
    drawPolyFull(c_shapeResult2.ctx_ui, r1);
    c_shapeResult2.ctx_ui.globalAlpha = 1;

    c_shapeResult1.ctx_ui.globalAlpha = 0.4;
    drawPolyFull(c_shapeResult1.ctx_ui, r2);
    c_shapeResult1.ctx_ui.globalAlpha = 1;

    drawAltCircle(hitPoints1Obj, hitPoints2Obj, image1ZeroPointFixMat, image2ZeroPointFixMat);
}

function wipeCanvases() {
    //only need to wipe the ui layer
    getCleanUICanvas("imageNoChanges");
    getCleanUICanvas("inputImage1");
    getCleanUICanvas("inputImage2");
    getCleanUICanvas("preppedImage1");
    getCleanUICanvas("preppedImage2");

    //wipe the whole thing
    getCleanCanvas("shapePreppedImage1");
    getCleanCanvas("shapePreppedImage2");
    getCleanCanvas("shapeResult1");
    getCleanCanvas("shapeResult2");
    getCleanCanvas("imageResult1");
    getCleanCanvas("imageResult2");
    getCleanCanvas("drawFragment1");
    getCleanCanvas("drawFragment2");
}

function drawPointOfRotation(ctx, shape, rotation) {

    let cPoint = findCentroid(shape);

    let transMat = getIdentityMatrix();
    transMat = matrixMultiply(getTranslateMatrix_point(cPoint, -1), transMat);
    transMat = matrixMultiply(getRotationMatrix(rotation), transMat);
    transMat = matrixMultiply(getTranslateMatrix_point(cPoint), transMat);

    shape = applyTransformationMatrixToAllKeypoints(shape, transMat);

    let topHalfBottomHalf = splitShapeHorz_m(shape, cPoint);
    let bottomHalf = topHalfBottomHalf[0];
    let topHalf = topHalfBottomHalf[1];
    let rightHalfLeftHalf = splitShapeVert_m(shape, cPoint);
    let topRight = rightHalfLeftHalf[0];
    let topLeft = rightHalfLeftHalf[1];

    let bottomPoint = findCentroid(topHalf);
    let topPoint = findCentroid(bottomHalf);
    let rightPoint = findCentroid(topRight);
    let leftPoint = findCentroid(topLeft);

    let transMat2 = matrixMultiply(getTranslateMatrix_point(cPoint, -1), transMat);
    transMat2 = matrixMultiply(getRotationMatrix(30), transMat2);
    transMat2 = matrixMultiply(getTranslateMatrix_point(cPoint), transMat2);


    let shape2 = applyTransformationMatrixToAllKeypoints(shape, transMat2);
    let topHalfBottomHalf2 = splitShapeHorz_m(shape2, cPoint);
    let topHalf2 = topHalfBottomHalf2[0];
    let bottomHalf2 = topHalfBottomHalf2[1];
    let rightHalfLeftHalf2 = splitShapeVert_m(shape2, cPoint);
    let topRight2 = rightHalfLeftHalf2[0];
    let topLeft2 = rightHalfLeftHalf2[1];

    let bottomPoint2 = findCentroid(topHalf2);
    let topPoint2 = findCentroid(bottomHalf2);
    let rightPoint2 = findCentroid(topRight2);
    let leftPoint2 = findCentroid(topLeft2);
    //
    // let transMat2 = getIdentityMatrix();
    // transMat2 = matrixMultiply(getTranslateMatrix_point(cPoint, -1), transMat2);
    // // transMat2 = matrixMultiply(getRotationMatrix(-rotation), transMat2);
    // transMat2 = matrixMultiply(getTranslateMatrix_point(cPoint), transMat2);
    //
    // bottomPoint = applyTransformationMatrixToPoint(bottomPoint, transMat2)
    drawPoint_m(ctx, bottomPoint);
    //
    // topPoint = applyTransformationMatrixToPoint(topPoint, transMat2)
    drawPoint_m(ctx, topPoint);
    //
    // rightPoint = applyTransformationMatrixToPoint(rightPoint, transMat2)
    drawPoint_m(ctx, rightPoint, 'purple');
    //
    // leftPoint = applyTransformationMatrixToPoint(leftPoint, transMat2)
    drawPoint_m(ctx, leftPoint, 'pink');

    $("#topAvgX").html(     "The total x values: " + (Math.abs(rightPoint[0]-200)+Math.abs(leftPoint[0]-200)) );
    $("#bottomAvgX").html(  "The total y values: " + (Math.abs(rightPoint2[0]-200)+Math.abs(leftPoint2[0]-200)) );

    $("#leftAvgX").html(     "The total x values: " + (Math.abs(bottomPoint[1]-200)+Math.abs(topPoint[1]-200)) );
    $("#rightAvgX").html(  "The total y values: " + (Math.abs(bottomPoint2[1]-200)+Math.abs(topPoint2[1]-200)) );


    // $("#topAvgX").html(     "Top___ x: "+(bottomPoint[0] - 200));
    // $("#bottomAvgX").html(  "Bottom x: "+(topPoint[0] - 200));
    // $("#leftAvgX").html(    "Left__ x: "+(leftPoint[0] - 200));
    // $("#rightAvgX").html(   "Right_ x: "+(rightPoint[0] - 200));
    //
    // $("#topAvgY").html(     "Top___ y: "+(bottomPoint[1] - 200));
    // $("#bottomAvgY").html(  "Bottom y: "+(topPoint[1] - 200));
    // $("#leftAvgY").html(    "Left__ y: "+(leftPoint[1] - 200));
    // $("#rightAvgY").html(   "Right_ y: "+(rightPoint[1] - 200));

}

function draw2(pageMousePosition) {
    if (!g_initImages) {
        initImages();
        g_initImages = true;
    }
    wipeCanvases();

    window.history.pushState("object or string", "Title", "index.html?point=" + g_globalState.canvasClickLocation.x + "," + g_globalState.canvasClickLocation.y + "&image=" + g_src);

    const clickedPoint = g_getClickedPoint();
    let shape = g_shape;
    shape = applyTransformationMatrixToAllKeypoints(shape, getTranslateMatrix_point(findCentroid(shape), -1));


    let transMat = getIdentityMatrix();
    
    // transMat = matrixMultiply(getScaleMatrix(5, 5), transMat)
    //transMat = matrixMultiply(g_transformState.appliedTransformationsMat, transMat)

    const shapeCenter = [0, 0]//FIXME:
    const transformations = g_transformState.temporaryAppliedTransformations;
    
    // //Rotate
    // transMat = matrixMultiply(getRotationMatrix(-transformations.rotation), transMat);
    // //Scale
    // transMat = matrixMultiply(transformations.directionalScaleMatrix, transMat);
    // transMat = matrixMultiply(getScaleMatrix(transformations.uniformScale, transformations.uniformScale), transMat);
    // transMat = matrixMultiply(getTranslateMatrix_point(transformations.translate, -1), transMat);

    transMat = matrixMultiply(g_transformState.appliedTransformationsMat, transMat)
    transMat = matrixMultiply(getTranslateMatrix(200, 200), transMat)

    shape = applyTransformationMatrixToAllKeypoints(shape, transMat);
    
    const c_shapeDemo = getCleanCanvas("shapeDemo");
    drawPolyFull(c_shapeDemo.ctx_ui, shape);

    for (let i = 0; i < 1; i += 5) {
        drawPointOfRotation(c_shapeDemo.ctx_ui, shape, i);
    }


    drawline_m(c_shapeDemo.ctx_ui, [[0, 200], [400, 200]], 'red');
    drawline_m(c_shapeDemo.ctx_ui, [[200, 0], [200, 400]], 'red');

    drawRotationEffect(pageMousePosition);
/*
    try {
        let hitPoints1Obj = getImage1HitPoints(clickedPoint.inputImage1);
        let hitPoints2Obj = getImage2HitPoints(clickedPoint.inputImage2);

        //calc the fixing matrix WITH GOOD SCALE
        const image1ZeroPointFixMat_withoutRotationFix = getShapeFixingTransformationMatrix(hitPoints1Obj.hitpoints_c).scaleFixMat;
        const image2ZeroPointFixMat = getShapeFixingTransformationMatrix(hitPoints2Obj.hitpoints_c).scaleFixMat;

        //do the rotation hack
        const image1ZeroPointFixMat = getRotationFixHack(hitPoints1Obj, hitPoints2Obj, image1ZeroPointFixMat_withoutRotationFix, image2ZeroPointFixMat);

        //FIXME: fade the actual fragment area, it'll look nice
        drawResultImages(hitPoints1Obj, hitPoints2Obj, image1ZeroPointFixMat, image2ZeroPointFixMat);

        drawFragments(hitPoints1Obj, hitPoints2Obj, image1ZeroPointFixMat, image2ZeroPointFixMat);

        drawUIElements(hitPoints1Obj, hitPoints2Obj, image1ZeroPointFixMat, image2ZeroPointFixMat);
    } catch(err) {
        console.log("bad point");
        return;
    }
    */
}

function draw(pageMousePosition) {
    draw2(pageMousePosition);
    // g_img = new Image();
    // g_img.onload = function () {
    //     setTimeout(draw2, 0)
    // };
    // g_img.src = g_src;
}

var counter = 0;

var images = ['image.png','image8-2.jpg', 'boo.jpg', 'spirited_away.jpg'];

// Assign onload handler to each image in array
for ( var i = 0; i < images.length; i++ ){

    var img    = new Image();
    img.onload = function(value){
        counter++;
        if (counter == images.length) {
            var url_string = window.location.href
            var url = new URL(url_string);
            var point = url.searchParams.get("point");
            var image = url.searchParams.get("image");
            console.log(point);
            console.log(image);
            try {
                if (point != undefined) {
                    var array = JSON.parse("[" + point + "]");
                    g_globalState.canvasClickLocation.x = array[0];
                    g_globalState.canvasClickLocation.y = array[1];
                }
            } catch(err) {
                g_globalState.canvasClickLocation.x = .5;
                g_globalState.canvasClickLocation.y = .5;
            }

            if (image != undefined && image != null && images.includes(image))
                changeImgSrc(image);
            else
                changeImgSrc(images[0]);
        }
    };

    // IMPORTANT - Assign src last for IE
    img.src = images[i];
}



// #     #                         ###
// #     #  ####  ###### #####      #  #    # #####  #    # #####
// #     # #      #      #    #     #  ##   # #    # #    #   #
// #     #  ####  #####  #    #     #  # #  # #    # #    #   #
// #     #      # #      #####      #  #  # # #####  #    #   #
// #     # #    # #      #   #      #  #   ## #      #    #   #
//  #####   ####  ###### #    #    ### #    # #       ####    #
//user input




$(document).mousedown(function (e) {
    //ignore
});

$(document).mousemove(function (e) {
    var pageMousePosition = getCurrentPageMousePosition(e);
    mouseMoveOnDocumentEvent(pageMousePosition);
    draw(pageMousePosition);
});

$(document).bind( "touchmove", function (e) {
    const pageMousePosition = [
        e.originalEvent.touches[0].pageX, 
        e.originalEvent.touches[0].pageY
    ]
    if (g_transformState != null && g_transformState.isMouseDownAndClickedOnCanvas) {
        e.preventDefault();
    }
    mouseMoveOnDocumentEvent(pageMousePosition);
});

$(document).mouseup(function (e) {
    mouseUpEvent();
    draw();
});

$(document).bind( "touchend", function (e) {
    mouseUpEvent()
});

let INTERACTIVE_CANVAS_OVERLAY_ID = "shapeDemo_ui";


$("#" + INTERACTIVE_CANVAS_OVERLAY_ID).mousedown(function (e) {
    e.preventDefault();
    
    var canvasElem = $("#" + INTERACTIVE_CANVAS_OVERLAY_ID)[0];
    const pageMousePosition = getCurrentPageMousePosition(e);
    const canvasMousePosition = getCurrentCanvasMousePosition(e, canvasElem);
    canvasMouseDownEvent(pageMousePosition, canvasMousePosition);
});

$(document).on('touchstart', "#" + INTERACTIVE_CANVAS_OVERLAY_ID, function(e) {
    e.preventDefault();
    const pageMousePosition = [
        e.originalEvent.touches[0].pageX,
        e.originalEvent.touches[0].pageY
    ];
    var canvasElem = $("#" + INTERACTIVE_CANVAS_OVERLAY_ID)[0];
    const canvasMousePosition = getCurrentCanvasMousePosition(e, canvasElem);    
    canvasMouseDownEvent(pageMousePosition, canvasMousePosition);
});


$("#" + INTERACTIVE_CANVAS_OVERLAY_ID).mousemove(function (e) {
    var canvasElem = $("#" + INTERACTIVE_CANVAS_OVERLAY_ID)[0];
    const canvasMousePosition = getCurrentCanvasMousePosition(e, canvasElem);

    canvasMouseMoveEvent(canvasMousePosition);
});

$(document).on('touchmove', "#" + INTERACTIVE_CANVAS_OVERLAY_ID, function(e) {
    e.preventDefault();
    var canvasElem = $("#" + INTERACTIVE_CANVAS_OVERLAY_ID)[0];
    const canvasMousePosition = getCurrentCanvasMousePosition(e, canvasElem);
    canvasMouseMoveEvent(canvasMousePosition);
});

$("#" + INTERACTIVE_CANVAS_OVERLAY_ID).mouseup(function (e) {
    if (g_transformState == null) {
        return;
    }
    //ignore
});

// $("#" + INTERACTIVE_CANVAS_OVERLAY_ID).mousedown(function (e) {
//     e.preventDefault();

//     var canvasElem = $("#" + "canvasImg1")[0];
//     const pageMousePosition = getCurrentPageMousePosition(e);
//     const canvasMousePosition = getCurrentCanvasMousePosition(e, canvasElem);
//     console.log(pageMousePosition);
//     console.log(canvasMousePosition);

//     g_globalState.canvasClickLocation = {x: canvasMousePosition.x/imgw, y: canvasMousePosition.y/imgh};
//     draw()
// });

$("#" + "imageNoChanges_ui").mousedown(function (e) {
    e.preventDefault();

    var canvasElem = $("#" + "imageNoChanges_ui")[0];
    const pageMousePosition = getCurrentPageMousePosition(e);
    const canvasMousePosition = getCurrentCanvasMousePosition(e, canvasElem);
    console.log(pageMousePosition);
    console.log(canvasMousePosition);

    g_globalState.canvasClickLocation = {x: canvasMousePosition[0]/imgw, y: canvasMousePosition[1]/imgh};
    draw();
});

