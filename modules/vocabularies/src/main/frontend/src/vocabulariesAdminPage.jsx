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

import {
  Button,
  Grid,
  TextField,
  Typography
} from "@material-ui/core";

import React from "react";

import VocabularyDirectory from "./vocabularyDirectory";

import OwlInstaller from "./owlInstaller";

import fetchBioPortalApiKey from "./bioportalApiKey";

const Phase = require("./phaseCodes.json");
const vocabLinks = require("./vocabularyLinks.json");

// Generates a URL to the vocabulary listing page
function generateRemoteLink(apiKey) {
  if (apiKey === null) {
    // never returned an incomplete URL without a valid key
    return "";
  }
  let url = new URL(vocabLinks["remote"]["base"]);
  url.searchParams.set("apikey", apiKey);
  Object.keys(vocabLinks["remote"]["params"]).forEach(
    (key) => {
      (key === "include" ? 
        url.searchParams.set(key, vocabLinks["remote"]["params"][key].join())
        :
        url.searchParams.set(key, vocabLinks["remote"]["params"][key])
      )
    }
  )
  return url.toString();
}

export default function VocabulariesAdminPage() {
  const [remoteVocabList, setRemoteVocabList] = React.useState([]);
  const [localVocabList, setLocalVocabList] = React.useState([]);
  const [customApiKey, setCustomApiKey] = React.useState(null);
  const [displayChangeKey, setDisplayChangeKey] = React.useState(false);
  /*
    The following object will map Acronym -> Release Date for a vocabulary. 
    This allows for efficiently figuring out whether an installed vocabulary is up to date 
  */
  const [acronymDateObject, setAcronymDateObject] = React.useState({});
  /* 
    The Phase represents the state of Vocabulary. It can be 1 of:
      1) Not Installed
      2) Installing
      3) Update Available
      4) Latest
      5) Uninstalling
  */
  const [acronymPhaseObject, setAcronymPhaseObject] = React.useState({});
  const [acronymPhaseSettersObject, setAcronymPhaseSettersObject] = React.useState({});
  const [remoteLoaded, setRemoteLoaded] = React.useState(false);
  const [localLoaded, setLocalLoaded] = React.useState(false);
  const [displayTables, setDisplayTables] = React.useState(false);
  /*
    Initially the key will be fetched from a script service.
  */
  const [bioPortalApiKey, setBioPortalApiKey] = React.useState(null);

  const localLink = '/query?query=' + encodeURIComponent(`select * from [lfs:Vocabulary]`);

  function processLocalVocabList(vocabList) {
    setLocalVocabList(vocabList);
    var tempObject = {};
    vocabList.map((vocab) => {
      tempObject[vocab.ontology.acronym] = vocab.released;
    });
    setAcronymDateObject(tempObject);
    setLocalLoaded(true);
  }

  function processRemoteVocabList(vocabList) {
    setRemoteVocabList(vocabList);
    setRemoteLoaded(true);
  }

  function addSetter(acronym, setFunction, type) {
    var copy = acronymPhaseSettersObject;
    if (copy.hasOwnProperty(acronym)) {
      copy[acronym][type] = setFunction;
    } else {
      var temp = {};
      temp[type] = setFunction;
      copy[acronym] = temp;
    }
    setAcronymPhaseSettersObject(copy);
  }

  function setPhase(acronym, phase) {
    const setters = acronymPhaseSettersObject[acronym];
    if (setters.hasOwnProperty("local")) {
      setters["local"](phase);
    }
    if (setters.hasOwnProperty("remote")) {
      setters["remote"](phase);
    }
  }

  function updateLocalList(action, vocab) {
    const acronym = vocab.ontology.acronym;

    if (action === "add") {
      var tempLocalVocabList = localVocabList.slice();
      tempLocalVocabList.push(vocab);
      setLocalVocabList(tempLocalVocabList);

    } else if (action === "remove") {
      var copy = acronymPhaseSettersObject;
      delete copy[acronym]["local"];
      setAcronymPhaseSettersObject(copy);
      setLocalVocabList(localVocabList.filter((vocab) => vocab.ontology.acronym != acronym));
    }
  }

  function determinePhase(acronym, released) {
    if (!acronymDateObject.hasOwnProperty(acronym)) {
      return Phase["Not Installed"];
    }
    const remoteReleaseDate = new Date(released);
    const localInstallDate = new Date(acronymDateObject[acronym]);
    return (remoteReleaseDate > localInstallDate ? Phase["Update Available"] : Phase["Latest"]);
  }

  if (localLoaded && remoteLoaded && !displayTables) {
    var tempAcronymPhaseObject = {};
    remoteVocabList.map((vocab) => {
      tempAcronymPhaseObject[vocab.ontology.acronym] = determinePhase(vocab.ontology.acronym, vocab.released)
    });
    setAcronymPhaseObject(tempAcronymPhaseObject);
    setDisplayTables(true);
  }

  if (bioPortalApiKey === null) {
    /* If the BioPortal API key cannot be loaded, assume the remote (empty)
     * data has been loaded.
     */
    fetchBioPortalApiKey(setBioPortalApiKey, () => {
        setRemoteLoaded(true);
        console.error("Can't fetch bioPortal API key");
    });
  }

  return (
    <Grid container direction="column" spacing={4} justify="space-between">

      <Grid item>
        <Typography variant="h2">
          Installed
        </Typography>
      </Grid>

      <VocabularyDirectory 
        type="local"
        link={localLink}
        vocabList={localVocabList}
        setVocabList={processLocalVocabList}
        acronymPhaseObject={acronymPhaseObject}
        displayTables={displayTables}
        updateLocalList={updateLocalList}
        addSetter={addSetter}
        setPhase={setPhase}
      />

      <Grid item>
        <Typography variant="h2">
          Install from local file
        </Typography>
      </Grid>

      <OwlInstaller updateLocalList={updateLocalList}/>

      <Grid item>
        <Typography variant="h2">
          Find on <a href="https://bioportal.bioontology.org/" target="_blank">BioPortal</a>
        </Typography>
      </Grid>

      {/* TODO: also fetch key from node - if it exists, override bioPortalApiKey --> place in new var */}
      {bioPortalApiKey === null
        ? (
          <Grid>
          <Grid item>
            <Typography>Your system does not have a Bioportal API Key configured</Typography>
            <Typography>Without an API key, you cannot access Bioportal services such as listing and installing vocabularies.</Typography>
          </Grid>
          <Grid item>
            <Button color="primary" href="https://bioportal.bioontology.org/help#Getting_an_API_key">Get API Key</Button>
          </Grid>
          <Grid item>
            <TextField
                 variant="outlined"
                 onChange={(evt) => {setCustomApiKey(evt.target.value)}}
                 value={customApiKey}
                 name="customApiKey"
                 label="Enter your Bioportal API key:"
            />
            <Button color="primary">Submit</Button> 
            {/* TODO: on submit, set node in backend to custon key. needs to trigger the servlet again to update key
            in the frontend */}
          </Grid>
          </Grid>
        )
        : (
          <Grid>
          {displayChangeKey
            ? (
              <Grid item>
                <TextField
                  variant="outlined"
                  onChange={(evt) => {setCustomApiKey(evt.target.value)}}
                  value={customApiKey}
                  name="customApiKey"
                  label="Enter the new Bioportal API key:"
                />
                {/* TODO: update button should have same functionality as above submit button */}
                <Button onClick={() => {setDisplayChangeKey(false)}} color="primary">Update</Button>
                <Button onClick={() => {setDisplayChangeKey(false)}} color="primary">Cancel</Button>
              </Grid>
            )
            : (
              <Grid item>
              {/* TODO: different label if from bioportal or from node */}
                <Typography>API Key: {bioPortalApiKey}</Typography>
                <Button onClick={() => {setDisplayChangeKey(true)}} color="primary">Change</Button> 
              </Grid>
            )
            }
          </Grid>
        )
      }
       
      <VocabularyDirectory 
        type="remote"
        link={generateRemoteLink(bioPortalApiKey)}
        vocabList={remoteVocabList}
        setVocabList={processRemoteVocabList}
        acronymPhaseObject={acronymPhaseObject}
        displayTables={displayTables}
        setPhase={setPhase}
        updateLocalList={updateLocalList}
        addSetter={addSetter}
      />

    </Grid>
  );
}
