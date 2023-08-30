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
import React from "react";
import { createRoot } from 'react-dom/client';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import { appTheme } from "../themePalette.jsx";
import PrintPreview from "../questionnaire/PrintPreview.jsx";

function EmbeddedView (props) {
  const resourcePath = window.location.pathname.split("embedded.html")[1];

  return (
    <PrintPreview
      open={true}
      fullScreen={true}
      resourcePath={resourcePath}
    />
  );
}

const root = createRoot(document.querySelector('#embedded-homepage-container'));
root.render(
  <StyledEngineProvider injectFirst>
    <ThemeProvider theme={appTheme}>
      <EmbeddedView />
    </ThemeProvider>
  </StyledEngineProvider>
);

export default EmbeddedView;
