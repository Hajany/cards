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
import React, { useState } from "react";
import PropTypes from "prop-types";
// @material-ui/core
import { withStyles } from "@material-ui/core";
import { Button, CircularProgress, IconButton, Tooltip, Typography } from '@material-ui/core';
// @material-ui/icons
import Info from "@material-ui/icons/Info";
import ArrowDown from "@material-ui/icons/KeyboardArrowDown";
import ArrowRight from "@material-ui/icons/KeyboardArrowRight";
import More from "@material-ui/icons/MoreHoriz";

import BrowseTheme from "./browseStyle.jsx";
import { REST_URL, MakeRequest } from "./util.jsx";

// Component that renders an element of the VocabularyTree, with expandable children.
//
// Required arguments:
//  defaultOpen: Boolean representing whether or not the branch is open
//  id: Term id to search
//  path: Term @path to get the term info
//  name: Text to display
//  onTermFocus: callback to change the term path being looked up
//  registerInfo: callback to add a possible hook point for the info box
//  getInfo: callback to change the currently displayed info box term
//  expands: boolean determining whether or not to allow this child to display its children
//  headNode: boolean determining whether or not this node is the topmost node in the browser
//  onError: callback when an error occurs
//  knownHasChildren: Boolean representing whether or not the term has children
//
// Optional arguments:
//  focused: boolean determining whether this entry is focused and should be visually emphasized
//           (a focused term entry is displayed as a root of a subtree, with only its parents above and its descendants below)
//
function VocabularyBranch(props) {
  const { defaultOpen, id, path, name, onTermFocus, registerInfo, getInfo, expands, headNode, focused, onError, knownHasChildren, classes } = props;

  const [ lastKnownID, setLastKnownID ] = useState();
  const [ currentlyLoading, setCurrentlyLoading ] = useState(typeof knownHasChildren === "undefined" && expands);
  const [ loadedChildren, setLoadedChildren ] = useState(false);
  const [ hasChildren, setHasChildren ] = useState(knownHasChildren);
  const [ childrenData, setChildrenData ] = useState();
  const [ children, setChildren ] = useState([]);
  const [ expanded, setExpanded ] = useState(defaultOpen);

  let loadTerm = (id, path) => {
    if (focused) return;
    if (onTermFocus) {
      setCurrentlyLoading(true);
      onTermFocus(path);
    } else {
      toggleShowChildren();
    }
  }

  let checkForChildren = () => {
    setLastKnownID(id);
    setCurrentlyLoading(true);
    // Determine if this node has children
    var url = new URL(path + ".info.json", window.location.origin);
    MakeRequest(url, updateChildrenData);
  }

  // Callback from checkForChildren to update whether or not this node has children
  // This does not recreate the child elements
  let updateChildrenData = (status, data) => {
    if (status === null) {
      setHasChildren(data["lfs:children"].length > 0);
      setChildrenData(data["lfs:children"]);
      setCurrentlyLoading(false);
      buildChildren(data["lfs:children"]);
    } else {
      onError("Error: children lookup failed with code " + status);
    }
  }

  // Given information about our children, create elements to display their data
  let buildChildren = (data) => {
    var children = data.map((row, index) =>
      (<VocabularyBranch
        classes={classes}
        id={row["identifier"]}
        path={row["@path"]}
        name={row["label"].trim()}
        onTermFocus={onTermFocus}
        registerInfo={registerInfo}
        getInfo={getInfo}
        expands={true}
        defaultOpen={false}
        key={index}
        headNode={false}
        onError={onError}
        knownHasChildren={row["lfs:hasChildren"]}
      />)
      );
    setLoadedChildren(true);
    setChildren(children);
  }

  // Update state with children elements
  let loadChildren = () => {
    // Prevent ourselves from reloading children if we've already loaded children or if we're
    // in the middle of grabbing data
    if (loadedChildren || !hasChildren || currentlyLoading) {
      return;
    }

    // See if we have the data necessary to build the children yet or not
    if (childrenData) {
      buildChildren(childrenData);
    } else {
      checkForChildren();
    }
  }

  let expandAction = (icon, title, clickHandler) => {
    let button = (
      <IconButton
        color={clickHandler ? "primary" : "default"}
        size="small"
        className={currentlyLoading ? ' ' + classes.loadingBranch : undefined}
        onClick={clickHandler}
        disabled={!clickHandler}
      >
        { icon }
        { currentlyLoading && <CircularProgress size={12} />}
      </IconButton>
    );
    return (
      <div className={classes.expandAction}>
        { title && clickHandler ?
          <Tooltip title={title}>{button}</Tooltip>
          :
          button
        }
      </div>
    );
  }

  let toggleShowChildren = () => {
    // Prevent a race condition when rapidly opening/closing
    // by loading children here, and stopping it from loading
    // children again
    if (!loadedChildren) {
      loadChildren();
    }
    setExpanded(!expanded);
    setLoadedChildren(true);
  }

  // Ensure we know whether or not we have children, if this is expandable
  if (expands) {
    // Ensure our child list entries are built, if this is currently expanded
    if (expanded) {
      // If our ID has changed, we need to fully reload our children
      if (lastKnownID != id) {
        checkForChildren();
      } else {
        loadChildren();
      }
    }
  }

  return(
    <div key={id} className={headNode ? "" : classes.branch}>
      {/* Expand button ▼ */}
      { hasChildren ?
        expandAction(
          expanded ? <ArrowDown/> : <ArrowRight/>,
          expanded ? "Collapse" : "Expand",
          toggleShowChildren
        )
        :
        ( expands ?
          expandAction(<ArrowRight/>)
          :
          expandAction(<More/>, "Show parent categories", () => loadTerm(id, path))
        )
      }

      {/* Term name */}
      <Typography onClick={() => loadTerm(id, path)}
                  className={classes.infoName + (focused ? (" " + classes.focusedTermName) : " ")}>
        {name.split(" ").length > 1 ? name.split(" ").slice(0,-1).join(" ") + " " : ''}
        <span className={classes.infoIcon}>
          {name.split(" ").pop()}&nbsp;
          {/* Button to open info page */}
          <IconButton
            size="small"
            color="primary"
            buttonRef={(node) => {registerInfo(id, node)}}
            onClick={(event) => {event.stopPropagation(); getInfo(path)}}
            className={classes.infoButton}
          >
            <Info color="primary" fontSize="small" className={classes.infoButton}/>
          </IconButton>
        </span>
      </Typography>

      {/* Children */}
      <div className={classes.childDiv + ((expands && expanded) ? " " : (" " + classes.hiddenDiv)) }> {children} </div>
    </div>
  );
}

VocabularyBranch.propTypes = {
  defaultOpen: PropTypes.bool.isRequired,
  id: PropTypes.string.isRequired,
  path: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  onTermFocus: PropTypes.func.isRequired,
  registerInfo: PropTypes.func.isRequired,
  getInfo: PropTypes.func.isRequired,
  expands: PropTypes.bool.isRequired,
  headNode: PropTypes.bool.isRequired,
  focused: PropTypes.bool,
  onError: PropTypes.func.isRequired,
  knownHasChildren: PropTypes.bool.isRequired,
  classes: PropTypes.object.isRequired
};

export default withStyles(BrowseTheme)(VocabularyBranch);
