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
import React, { useState, useEffect, useContext }  from 'react';
import { v4 as uuidv4 } from 'uuid';

import {
  Button,
  FormControl,
  Grid,
  Input,
  InputLabel,
  Typography,
  makeStyles
} from '@material-ui/core';

import ToUDialog from "./ToUDialog.jsx";

import { fetchWithReLogin, GlobalLoginContext } from "./login/loginDialogue.js";

import { identifyPatient } from "./patientLookup.jsx";

const useStyles = makeStyles(theme => ({
  form : {
    margin: theme.spacing(6, 3, 3),
  },
  logo : {
    maxWidth: "240px",
  },
  instructions : {
    textAlign: "center",
  },
}));

function MockPatientIdentification(props) {
  const { onSuccess } = props;

  const [ dob, setDob ] = useState();
  const [ mrn, setMrn ] = useState();
  const [ hc, setHc ] = useState();
  const [ error, setError ] = useState();
  const [ idData, setIdData ] = useState();
  const [ patient, setPatient ] = useState();
  const [ visit, setVisit ] = useState();

  const [ subjectTypes, setSubjectTypes ] = useState();

  const [ touAccepted, setTouAccepted ] = useState();
  const [ showTou, setShowTou ] = useState(false);
  const [ touOk, setTouOk ] = useState(false);
  // Info about each patient is stored in a Patient information form
  const [ piForm, setPiForm ] = useState();

  const TOU_ACCEPTED_VARNAME = 'tou_accepted'

  const classes = useStyles();

  const globalLoginDisplay = useContext(GlobalLoginContext);

  // At startup, load subjectTypes
  useEffect(() => {
    fetchWithReLogin(globalLoginDisplay, "/query?query=" + encodeURIComponent("SELECT * FROM [cards:SubjectType]"))
      .then((response) => response.ok ? response.json() : Promise.reject(response))
      .then((json) => {
        let types = {};
        json.rows.forEach(r => types[r['@name']] = r['jcr:uuid']);
        setSubjectTypes(types);
      })
      .catch((response) => {
        setError(`Subject type retrieval failed with error code ${response.status}: ${response.statusText}`);
      });
  }, []);

  const sanitizeHC = (str) => {
    return str?.toUpperCase().replaceAll(/[^A-Z0-9]*/g, "") || "";
  }

  const identify = () => {
    return identifyPatient(dob, mrn, hc);
  }

  // On submitting the patient login form, make a request to identify the patient
  // If identification is successful, store the returned identification data (idData)
  const onSubmit = (event) => {
    event?.preventDefault();
    if (!dob || !mrn && !hc) {
      setError("Date of birth and either MRN or Health Card Number are required for patient identification");
      return;
    }
    setError("");
    setIdData(null);
    setPatient(null);
    setVisit(null);
    let data = identify();
    if (data) {
      setIdData(data);
    } else {
      setError("No records match the submitted information");
    }
  }

  // When the identification data is successfully obtained, get the patient subject's path
  useEffect(() => {
    idData && getPatient();
  }, [idData]);

  const getPatient = () => {
    getSubject(
      "Patient",   /* subject type */
      "/Subjects", /* path prefix*/
      idData.mrn,  /* id */
      'MRN',       /* id label */
      setPatient   /* successCallback */
    );
  }

  // When the patient subject path is successfully obtained, get the visit "subject"
  useEffect(() => {
    patient && getVisit();
  }, [patient]);

  const getVisit = () => {
    getSubject(
      "Visit",              /* subject type */
      patient,              /* path prefix*/
      idData.visit_number,  /* id */
      'visit number',       /* id label */
      setVisit              /* successCallback */
    );
  }

  // When the patient subject is successfully obtained, check if terms of use have been accepted
  useEffect(() => {
    patient && queryTouStatus();
  }, [patient]);

  const queryTouStatus = () => {
     fetch(`${patient}.data.deep.json`)
       .then( response => response.ok ? response.json() : Promise.reject(response) )
       .then((response) => {
          // There should be exactly one form of this type
          let piData = response["Patient information"]?.[0];
          if (piData) {
            let answer = Object.values(piData)
              .filter(item => item["sling:resourceSuperType"] == "cards/Answer")
              .find(item => item.question?.["@name"] == TOU_ACCEPTED_VARNAME)?.value;
            // Store the version of Terms of use that has already been accepted, if any
            answer && setTouAccepted(answer);
console.log(answer);
            // Store the form data for when the user accepts the Terms of Use
            // and that form needs to be updated
            setPiForm(piData);
            // Now the Terms of Use can be shown if applicable
            setShowTou(true);
          }
        })
        .catch( response => {
          let errMsg = "Loading account information failed";
          setError(errMsg + (response.status ? ` with error code ${response.status}: ${response.statusText}` : ''));
        });
  }

  // When the patient user accepts the terms of use, hide the ToU dialog and save their preference
  useEffect(() => {
    if (!touAccepted || !showTou || !piForm) return;
    setShowTou(false);
    saveTouAccepted(piForm);
  }, [touAccepted, showTou, piForm]);

  const saveTouAccepted = (piForm) => {
     let request_data = new FormData();
     // Populate the request data with information about the tou_accepted answer
     let f = TOU_ACCEPTED_VARNAME;
     let qDef = piForm.questionnaire[f];
     request_data.append(`./${f}/jcr:primaryType`, `cards:TextAnswer`);
     request_data.append(`./${f}/question`, qDef['jcr:uuid']);
     request_data.append(`./${f}/question@TypeHint`, "Reference");
     request_data.append(`./${f}/value`, touAccepted);
     request_data.append(`./${f}/value@TypeHint`, "String");

     // Update the Patient information form
     fetch(piForm['@path'], { method: 'POST', body: request_data })
       .then( (response) => response.ok ? null : Promise.reject(response))
       .catch((response) => {
         let errMsg = "Recording acceptance of Terms of Use failed";
         setError(errMsg + (response.status ? ` with error code ${response.status}: ${response.statusText}` : ''));
       });
  }

  // When the visit is successfully obtained and the latest version of Terms of Use accepted, pass it along with the identification data
  // to the parent component
  useEffect(() => {
    visit && touOk && onSuccess && onSuccess(Object.assign({subject: visit}, idData));
  }, [visit, touOk]);

  // Get the path of a subject with a specific identifier
  // if the subject doesn't exist, create it
  const getSubject = (subjectType, pathPrefix, subjectId, subjectIdLabel, successCallback) => {
    // If the patient doesn't yet have an MRN, or the visit doesn't yet have a number, abort mission
    // TODO: after we find out if the MRN is not always assigned in the DHP,
    // in which case implement a different logic for finding the patient
    if (!subjectId) {
      setError(`The record was found but no ${subjectIdLabel} has been assigned yet. Please try again later or contact your care team for next steps.`);
      return;
    }

    // Look for the subject identified by subjectId
    let query=`SELECT * FROM [cards:Subject] as s WHERE ischildnode(s, "${pathPrefix}") AND s.identifier="${subjectId}"`;
    fetchWithReLogin(globalLoginDisplay, "/query?query=" + encodeURIComponent(query))
      .then((response) => response.ok ? response.json() : Promise.reject(response))
      .then((json) => {
         let results = json.rows;
         if (results.length == 0) {
           // Subject not found: create it
           createSubject(subjectType, pathPrefix, subjectId, successCallback);
         } else if (results.length == 1) {
           // Subject found: return its path
           successCallback(results[0]['@path']);
         } else {
           // More than one subject found, not sure which one to pick: display error
           // Note: This should never actually happen
           setError("More than one matching record found. Please inform the technical administrator.");
         }
      })
      .catch((response) => {
        setError(`Record identification failed with error code ${response.status}: ${response.statusText}`);
      });
  }

  // Create a new subject if it's the first time we receive this identifier
  const createSubject = (type, path, id, successCallback) => {
    // Make a POST request to create a new subject
    let requestData = new FormData();
    requestData.append('jcr:primaryType', 'cards:Subject');
    requestData.append('identifier', id);
    requestData.append('type', subjectTypes[type]);
    requestData.append('type@TypeHint', 'Reference');

    let subjectPath = `${path}/` + uuidv4();
    fetchWithReLogin(globalLoginDisplay, subjectPath, { method: 'POST', body: requestData })
      .then((response) => response.ok ? successCallback(subjectPath) : Promise.reject(response))
      .catch((response) => {
        setError(`Data recording failed with error code ${response.status}: ${response.statusText}`);
      });
  }

  // ---------------------------------------------------------------------------------------------------
  // Keep the patient information up to date

  // The definition of the Patient information questionnaire
  // Info about each patient is stored in a Patient information form
  const [ piDefinition, setPiDefinition ] = useState();

  // Load the Patient Information questionnaire
  useEffect(() => {
    fetchWithReLogin(globalLoginDisplay, "/Questionnaires/Patient information.deep.json")
      .then((response) => response.ok ? response.json() : Promise.reject(response))
      .then((json) => setPiDefinition(json))
      .catch((response) => {
         setError(`Initializing information sync failed with error code ${response.status}: ${response.statusText}`);
       });
  }, []);

  // When the patient is successfully identified, sync their information
  useEffect(() => {
    patient && piDefinition && syncPatientInfo();
  }, [patient, piDefinition]);

  const syncPatientInfo = () => {
    // Fetch the patient subject and forms associated with it
    fetchWithReLogin(globalLoginDisplay, `${patient}.data.deep.json`)
      .then((response) => response.ok ? response.json() : Promise.reject(response))
      .then((json) => {

        // Check if the data includes a patient information form
        let piForm = json?.[piDefinition['title']]?.[0];
        if (piForm?.["jcr:primaryType"] == "cards:Form") {
          // The form already exists, get its path for the update request
          updatePatientInfo(piForm['@path']);
        } else {
          // The form doesn't exist, generate the path and populate the request data for form creation
          let request_data = new FormData();
          let formPath = "/Forms/" + uuidv4();
          request_data.append('jcr:primaryType', 'cards:Form');
          request_data.append('questionnaire', piDefinition["@path"]);
          request_data.append('questionnaire@TypeHint', 'Reference');
          request_data.append('subject', patient);
          request_data.append('subject@TypeHint', 'Reference');

          // Create or update the Patient information form
          fetchWithReLogin(globalLoginDisplay, formPath, { method: 'POST', body: request_data })
            .then( (response) => response.ok ? updatePatientInfo(formPath) : Promise.reject(response))
            .catch((response) => {
              setError(`Information sync failed with error code ${response.status}: ${response.statusText}`);
            });
        }
      })
      .catch((response) => {
        setError(`Local record retrieval failed with error code ${response.status}: ${response.statusText}`);
        console.log(response);
      });
  }

  const updatePatientInfo = (formPath) => {
     let request_data = new FormData();
     // Populate the request data with the values obtained when identifying the patient
     let fields = Object.keys(piDefinition).filter(k => piDefinition[k]?.["jcr:primaryType"] == "cards:Question");
     fields.forEach(f => {
       if (!idData[f]) return;
       let qDef = piDefinition[f];
       let type = (qDef.dataType || 'text');
       // Capitalize the type:
       type = type[0].toUpperCase() + type.substring(1);

       // Add each field to the request
       request_data.append(`./${f}/jcr:primaryType`, `cards:${type}Answer`);
       request_data.append(`./${f}/question`, qDef['jcr:uuid']);
       request_data.append(`./${f}/question@TypeHint`, "Reference");
       request_data.append(`./${f}/value`, idData[f]);
       request_data.append(`./${f}/value@TypeHint`, type == 'Text' ? 'String' : type);
     })
     // Update the Patient information form
     fetchWithReLogin(globalLoginDisplay, formPath, { method: 'POST', body: request_data })
       .then( (response) => response.ok ? null : Promise.reject(response))
       .catch((response) => {
         let errMsg = "Information sync failed";
         setError(errMsg + (response.status ? ` with error code ${response.status}: ${response.statusText}` : ''));
       });
  }

  // -----------------------------------------------------------------------------------------------------
  // Rendering

  if (!subjectTypes) {
    return null;
  }

  return (<>
    <ToUDialog
      open={showTou}
      onLoad={setTouOk}
      actionRequired={true}
      acceptedVersion={touAccepted}
      onClose={() => setShowTou(false)}
      onAccept={setTouAccepted}
      onDecline={() => {
        setShowTou(false)
        setIdData(null);
        setPatient(null);
      }}
    />
    <form className={classes.form} onSubmit={onSubmit} >
      <Grid container direction="column" spacing={4} alignItems="center" justify="center">
         <Grid item xs={12}>
           <img src="/libs/cards/resources/logo_light_bg.png" className={classes.logo} alt="logo" />
         </Grid>
         <Grid item xs={12} className={classes.instructions}>
         { error ?
           <Typography color="error">{error}</Typography>
           :
           <Typography>Please enter the following information for identification</Typography>
         }
         </Grid>
         <Grid item xs={12}>
            <FormControl margin="normal" required fullWidth>
              <InputLabel htmlFor="j_dob" shrink={true}>Date of birth</InputLabel>
              <Input id="j_dob" name="j_dob" autoComplete="off" type="date" autoFocus onChange={event => setDob(event.target.value)}/>
            </FormControl>
            <Grid container direction="row" alignItems="flex-end" spacing={3} wrap="nowrap">
              <Grid item>
                <FormControl margin="normal" fullWidth>
                  <InputLabel htmlFor="j_mrn" shrink={true}>MRN</InputLabel>
                  <Input id="j_mrn" name="j_mrn" autoComplete="off" type="number" placeholder="E.g.: 1234567" onChange={event => setMrn(event.target.value)}/>
                 </FormControl>
              </Grid>
              <Grid item>or</Grid>
              <Grid item>
                <FormControl margin="normal" fullWidth>
                  <InputLabel htmlFor="j_hc" shrink={true}>Health card number</InputLabel>
                  <Input id="j_hc" name="j_hc" autoComplete="off" placeholder="E.g.: 2345 678 901 XY" onChange={event => setHc(sanitizeHC(event.target.value))}/>
                 </FormControl>
              </Grid>
            </Grid>
          </Grid>
          <Grid item>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              className={classes.submit}
              >
              Submit
            </Button>
          </Grid>
       </Grid>
    </form>
  </>)
}

export default MockPatientIdentification;
