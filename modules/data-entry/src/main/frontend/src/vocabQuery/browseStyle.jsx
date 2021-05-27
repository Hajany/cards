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

import queryStyle from "./queryStyle.jsx";

const browseStyle = theme => ({
    ...queryStyle(theme),
    dialog: {
      // The dialogue appears in the wrong location without the following
      padding: theme.spacing(1),
    },
    dialogPaper: {
      top: "0px",
      position: "absolute",
    },
    closeButton: {
      position: 'absolute',
      right: theme.spacing(1),
      top: theme.spacing(1),
    },
    infoName: {
      whiteSpace: "normal", // Enable line wrapping
      color: theme.palette.text.primary,
      display: 'inline',
      cursor: 'pointer'
    },
    infoIcon: {
      whiteSpace: "nowrap"
    },
    treeContainer: {
      padding: theme.spacing(2,2,2,6),
    },
    // Tree components
    treeRoot: {
      display: "block",
    },
    treeNode: {
      // Nothing in here for now, but this is here in case we
      // want to apply themes in the future
      marginLeft: theme.spacing(2.75),
    },
    branch: {
      display: "block",
    },
    childDiv: {
      marginLeft: theme.spacing(2.75),
    },
    expandAction: {
      display: "inline-block",
      marginLeft: theme.spacing(-4),
    },
    loadingBranch: {
      "& .MuiSvgIcon-root": {
        visibility: "hidden",
      },
      "& .MuiCircularProgress-root": {
        position: "absolute",
      },
    },
    hiddenDiv: {
      display: "none",
    },
    focusedTermName: {
      fontWeight: "bold",
    },
});

export default browseStyle;
