//
//  Licensed to the Apache Software Foundation (ASF) under one
//  or more contributor license agreements.  See the NOTICE file
//  distributed with this work for additional information
//  regarding copyright ownership.  The ASF licenses this file
//  to you under the Apache License, Version 2.0 (the
//  "License"); you may not use this file except in compliance
//  with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing,
//  software distributed under the License is distributed on an
//  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
//  KIND, either express or implied.  See the License for the
//  specific language governing permissions and limitations
//  under the License.
//

import React, { useEffect, useState } from "react";
import { loadExtensions } from "../../uiextension/extensionManager";
import { Button } from "@material-ui/core";

export default function PageStart(props) {

  const [ componentHeights, setComponentHeights ] = useState([]);
  const [ componentPositions, setComponentPositions ] = useState([]);
  const [ triggerRedraw, setTriggerRedraw ] = useState(false);
  const [ extensionData, setExtensionData ] = useState(null);
  const [ isInitialized, setIsInitialized ] = useState(false);
  const [ pageStartHeight, setPageStartHeight ] = useState(0);
  useEffect(() => {
    props.setTotalHeight(pageStartHeight);
  });

  const arrayEquals = (a, b) => {
    return (
      Array.isArray(a) && Array.isArray(b) &&
      (a.length === b.length) &&
      a.every((val, i) => val === b[i])
    );
  };

  //Redraw the top elements if the browser window is resized
  window.onresize = () => {
    setTriggerRedraw(true);
  };

  if (!isInitialized) {
    loadExtensions("PageStart")
      .then((resp) => {
        if (resp.length > 0) {
          setExtensionData(resp);
          let zeros = [];
          for (let i = 0; i < resp.length; i++) {
            zeros.push(0);
          }
          setComponentHeights(zeros.slice());
          setComponentPositions(zeros.slice());
        }
        setIsInitialized(true);
      });
  }

  if (!isInitialized) {
    return (
      <Button variant="contained" color="primary" style={{ position: 'fixed', zIndex: 1040 }}>
        Loading PageStart Content...
      </Button>
    );
  }

  if (extensionData == null) {
    return null;
  }

  let visualComponents = [];
  for (let i = 0; i < extensionData.length; i++) {
    visualComponents.push(extensionData[i]["lfs:extensionRender"]);
  }

  let newComponentPositions = [];
  let totalHeight = 0;
  for (let i = 0; i < componentHeights.length; i++) {
    newComponentPositions.push(totalHeight);
    totalHeight += componentHeights[i];
  }
  if (!arrayEquals(componentPositions, newComponentPositions)) {
    setComponentPositions(newComponentPositions);
  }

  if (pageStartHeight != totalHeight) {
    setPageStartHeight(totalHeight);
  }

  return (
    <React.Fragment>
    {
      visualComponents.map((ThisComp, index) => {
        return (
          <ThisComp
            {...props}
            key={index}
            style={{ top: (componentPositions[index]) + 'px' }}
            onRender={(node) => {
                if (node != null) {
                  let n = node.getBoundingClientRect().height;
                  if (componentHeights[index] != n) {
                    let newComponentHeights = componentHeights.slice();
                    newComponentHeights[index] = n;
                    setComponentHeights(newComponentHeights);
                  }
                }
              }
            }
          />
        );
      })
    }
    </React.Fragment>
  );
}
