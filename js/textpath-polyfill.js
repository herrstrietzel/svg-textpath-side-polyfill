
function polyfillAllTextPathSides(){
  let svgs = document.querySelectorAll('svg')
  let polyfilled=false;
  svgs.forEach(svg=>{
    polyfilled= polyfillTextPathSide(svg)
  })
  return polyfilled
}


function polyfillTextPathSide(svg){
  const svgNS = 'http://www.w3.org/2000/svg'
  let textpaths = svg.querySelectorAll('textPath[side=right]')
  let textPathRefIds = new Set([])
  let polyfilled = false;
  
  // test native support
   if(SVGTextElement.prototype.getStartPositionOfChar ) {
    let textPath0 = textpaths[0];
    let charPosR = textPath0.getStartPositionOfChar(0);
    textPath0.setAttribute('side', 'left')
    let charPosL = textPath0.getStartPositionOfChar(0);
     
     // native support - no need to polyfill
     if(charPosR.x!==charPosL.x || charPosR.y!==charPosL.y){
       textPath0.setAttribute('side', 'right')
       return false
     }
   }
  
  
  textpaths.forEach(el=>{
    let href= el.getAttribute('href') || el.getAttribute('xlink:href')
    let refId = href.substring(1)
   textPathRefIds.add(refId)
    el.setAttribute('href', `#${refId}__clone`) 
  })
  
  textPathRefIds = [...textPathRefIds];
  
  textPathRefIds.forEach(id=>{
    let needsCloning = svg.querySelectorAll(`[href="#${id}"]`).length > 1
    let textPath = svg.getElementById(id)
    let clone = textPath

    // clone textpath or replace
    if( needsCloning){
      clone = textPath.cloneNode(true);
      // add id suffix
      clone.id = textPath.id+'__clone';
      
      // append cloned text path
      textPath.parentNode.insertBefore(clone, textPath)
    }
    
    // convert to all absolute commands
    let pathData = clone.getPathData({normalize:true});
    
    // reverse pathdata
    pathData = reversePathData(pathData);
    clone.setPathData(pathData)
    
  })
  
  polyfilled = true;
  return polyfilled;
    
}



function reversePathData(pathData) {

    /**
     * Add closing lineto:
     * needed for path reversing or adding points
     */
    const addClosePathLineto = (pathData, closed=false) => {
        let len = pathData.length;
        let M = pathData[0];
        let [x0, y0] = M.values;
        let lastCom = closed ? pathData[len - 2] : pathData[len - 1];
        let [xE, yE] = [lastCom.values[lastCom.values.length - 2], lastCom.values[lastCom.values.length - 1]];

        //addClosePathLineto
        if (closed) {

            pathData.pop();
            pathData.push(
                {
                    type: "L",
                    values: M.values
                },
                {
                    type: "Z",
                    values: []
                }
            );
        }
        return pathData;
    }

    // helper to rearrange control points for all command types
    const reverseControlPoints = (type, values) => {
        let controlPoints = [];
        let endPoints = [];
      
        // is arc
        if (type === "A") {
            //reverse sweep;
            let sweep = values[4] == 0 ? 1 : 0;
            controlPoints = [values[0], values[1], values[2], values[3], sweep];
            endPoints = [values[5], values[6]];
        }
        else {
            for (let p = 0; p < values.length; p += 2) {
                controlPoints.push([values[p], values[p + 1]]);
            }
            endPoints = controlPoints.pop();
            controlPoints.reverse();
        }
        return { controlPoints, endPoints };
    };


    // start compiling new path data
    let pathDataNew = [];

    let l=pathData.length
    let closed = pathData[l - 1].type.toLowerCase() === "z" ? true : false;
    if (closed) {
        // add lineto closing space between Z and M
        pathData = addClosePathLineto(pathData, closed);
        // remove Z closepath
        pathData.pop();
    }

    // define last point as new M if path isn't closed
    let valuesLast = pathData[l - 1].values;
    let valuesLastL = valuesLast.length;
    let M = closed
        ? pathData[0]
        : {
            type: "M",
            values: [valuesLast[valuesLastL - 2], valuesLast[valuesLastL - 1]]
        };
    // starting M stays the same – unless the path is not closed
    pathDataNew.push(M);

    // reverse path data command order for processing
    pathData.reverse();
    for (let i = 1; i < l; i++) {
        let com = pathData[i];
        let {type, values} = com;
        let comPrev = pathData[i - 1];
        let [typePrev,valuesPrev] = [comPrev.type, comPrev.values];

        // get reversed control points and new end coordinates
        let controlPointsPrev = reverseControlPoints(typePrev, valuesPrev).controlPoints;
        let endPoints = reverseControlPoints(type, values).endPoints;

        // create new path data
        pathDataNew.push({
            type: typePrev,
            values: [...controlPointsPrev, ...endPoints]
        });
    }

    // add previously removed Z close path
    if (closed) {
        pathDataNew.push({
            type: "z",
            values: []
        });
    }


    return pathDataNew;
}
