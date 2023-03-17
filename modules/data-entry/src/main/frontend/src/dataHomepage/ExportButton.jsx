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
import React, { useState, useEffect, useContext } from 'react';
import PropTypes from "prop-types";
import { makeStyles } from '@mui/styles';
import { deepPurple, orange } from '@mui/material/colors';

import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import { Avatar, Checkbox, DialogActions, DialogContent, Divider, Stack, FormControl, Icon, Grid, Radio, RadioGroup,
  FormControlLabel, TextField, Typography, Button, IconButton, Tooltip } from "@mui/material";
import { List, ListItem, ListItemAvatar, ListItemButton, ListItemText } from "@mui/material";
import DownloadIcon from '@mui/icons-material/FileDownload';
import CloseIcon from '@mui/icons-material/Close';

import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterLuxon } from "@mui/x-date-pickers/AdapterLuxon";
import { LocalizationProvider } from '@mui/x-date-pickers';

import { fetchWithReLogin, GlobalLoginContext } from "../login/loginDialogue.js";
import ResponsiveDialog from "../components/ResponsiveDialog";

const useStyles = makeStyles(theme => ({
  container: {
    marginBottom: theme.spacing(1.5),
    "& + .MuiDivider-root" : {
      margin: theme.spacing(3, -3),
    },
  },
  withMultiSelect: {
    "& > .MuiGrid-item:first-child" : {
      marginTop: theme.spacing(1),
    },
    "& .MuiListItem-root": {
      paddingLeft: 0,
    },
    "& .MuiDivider-root": {
      marginLeft: theme.spacing(7),
    },
  },
  withSelect: {
    "& > .MuiGrid-item:first-child" : {
      marginTop: theme.spacing(.5),
    },
  },
  avatar: {
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.primary,
    fontWeight: "bold",
  },
  dateRange: {
    alignItems: "baseline",
    marginBottom: theme.spacing(-1.5),
    "& .MuiInputLabel-shrink": {
      visibility: "hidden",
    },
    "& + .MuiTypography-root": {
      marginTop: theme.spacing(-2.5),
    },
  },
}));

const filterOptions = createFilterOptions({
  stringify: (option) => `${option.name} ${option.text || option.principalName}`
});

let findQuestionsOrSections = (json, result = []) =>  {
  Object.entries(json || {}).forEach(([k,e]) => {
    if (e?.['jcr:primaryType'] == "cards:Question" || e?.['jcr:primaryType'] == "cards:Section") {
      result.push({name: e['@name'], text: e['text'] || e['label'], path: e['@path'], type: e['jcr:primaryType'].replace("cards:", '')});
      e?.['jcr:primaryType'] == "cards:Section" && findQuestionsOrSections(e, result);
    } else if (typeof(e) == 'object') {
      findQuestionsOrSections(e, result);
    }
  })
  return result;
}

let entitySpecs = {
  Question: {
    color: deepPurple[700]
  },
  Section: {
    icon: "view_stream",
    color: orange[800]
  }
}

/**
 * A component that renders an icon or button to open the export dialog that generates an export URL for an entry.
 */
function ExportButton(props) {
  const { entityData, entryLabel, entryPath, entryName, variant, size, onClose } = props;

  const DEFAULTS = {
    fileFormat : ".csv",
    hasHeaderLabels: true,
    hasHeaderIdentifiers: false,
    hasAnswerLabels: false,
    columnSelectionMode: "exclude",
    statusSelectionMode: "status",
  }

  const [ open, setOpen ] = useState(false);
  // List of questions and sections to display in dropdown select to exclude/include
  const [ entities, setEntities] = useState();

  // Decides if the generated export URL ends in .csv or in .tsv
  const [ fileFormat, setFileFormat ] = useState(DEFAULTS.fileFormat);
  // Decides if/how .csvHeader is specified:
  // by default we have csvHeader:labels
  // to disable labels, add .-csvHeader:labels
  // to enable identifiers, add .csvHeader:raw
  const [ hasHeaderLabels, setHeaderLabels ] = useState(DEFAULTS.hasHeaderLabels);
  const [ hasHeaderIdentifiers, setHeaderIdentifiers ] = useState(DEFAULTS.hasHeaderIdentifiers);
  // Specifies if the .labels processor is enabled (disabled by default for values)
  const [ hasAnswerLabels, setAnswerLabels ] = useState(DEFAULTS.hasAnswerLabels);

  // Column selection:
  // just one of the Include or Exclude options should be available at a time
  const [ columnSelectionMode, setColumnSelectionMode ] = useState(DEFAULTS.columnSelectionMode);
  // List of question or section ids to Include or Exclude
  const [ selectedEntityIds, setSelectedEntityIds ] = useState([]);

  const [ users, setUsers ] = useState();
  const [ createdBy, setCreatedBy ] = useState(null);
  const [ modifiedBy, setModifiedBy ] = useState(null);

  const [ createdAfter, setCreatedAfter ] = useState(null);
  const [ createdBefore, setCreatedBefore ] = useState(null);
  const [ modifiedAfter, setModifiedAfter ] = useState(null);
  const [ modifiedBefore, setModifiedBefore ] = useState(null);
  const [ createdRangeIsInvalid, setCreatedRangeIsInvalid ] = useState(false);
  const [ modifiedRangeIsInvalid, setModifiedRangeIsInvalid ] = useState(false);

  const statuses = [ "DRAFT", "INCOMPLETE", "INVALID", "SUBMITTED" ];
  const [ statusSelectionMode, setStatusSelectionMode ] = useState(DEFAULTS.statusSelectionMode);
  const [ status, setStatus ] = useState(null);

  const classes = useStyles();
  const globalLoginDisplay = useContext(GlobalLoginContext);

  useEffect(() => {
    if (entityData && !entities) {
      setEntities(findQuestionsOrSections(entityData));
    }
    if (!entityData && entryPath && !entities && open) {
      fetchWithReLogin(globalLoginDisplay, `${entryPath}.deep.json`)
        .then((response) => response.ok ? response.json() : Promise.reject(response))
        .then((json) => {
          setEntities(findQuestionsOrSections(json));
        });
    }
  }, [entityData, open]);

  useEffect(() => {
    if (!users && open) {
      fetchWithReLogin(globalLoginDisplay, "/home/users.json")
        .then((response) => response.ok ? response.json() : Promise.reject(response))
        .then((json) => {
          setUsers(json.rows);
        });
    }
  }, [open]);

  // Determine if the before date is earlier than the after date
  useEffect(() => {
    open && setCreatedRangeIsInvalid(!!createdAfter && !!createdBefore && new Date(createdBefore).valueOf() <= new Date(createdAfter).valueOf());
  }, [createdAfter, createdBefore]);

  useEffect(() => {
    open && setModifiedRangeIsInvalid(!!modifiedAfter && !!modifiedBefore && new Date(modifiedBefore).valueOf() <= new Date(modifiedAfter).valueOf());
  }, [modifiedAfter, modifiedBefore]);

  let openDialog = () => {
    entryPath && !open && setOpen(true);
  }

  let closeDialog = () => {
    open && setOpen(false);
    onClose?.();
  }

  let handleExport = () => {
    // Construct the export URL
    let path = entryPath;
    if (!hasHeaderLabels) {
      path += ".-csvHeader:labels";
    }
    if (hasHeaderIdentifiers) {
      path += ".csvHeader:raw";
    }
    if (selectedEntityIds.length > 0) {
      path +=  ".questionnaireFilter";
      let pref = `.questionnaireFilter:${columnSelectionMode}=`;
      for (let id in selectedEntityIds) {
        path += pref + encodeURIComponent(encodeURIComponent(selectedEntityIds[id]));
      }
    }
    if (hasAnswerLabels) {
      path += ".labels";
    }
    if (createdBy) {
      path += ".dataFilter:createdBy=" + createdBy;
    }
    if (modifiedBy) {
      path += ".dataFilter:modifiedBy=" + modifiedBy;
    }
    if (createdAfter) {
      path += ".dataFilter:createdAfter=" + createdAfter.toISO();
    }
    if (createdBefore) {
      path += ".dataFilter:createdBefore=" + createdBefore.toISO();
    }
    if (modifiedAfter) {
      path += ".dataFilter:modifiedAfter=" + modifiedAfter.toISO();
    }
    if (modifiedBefore) {
      path += ".dataFilter:modifiedBefore=" + modifiedBefore.toISO();
    }
    if (status) {
      let pref = `.dataFilter:${statusSelectionMode}=`;
      path += pref + encodeURIComponent(encodeURIComponent(status));
    }
    path += fileFormat;
    window.open(path, '_blank');
  }

  let unselectEntity = (index) => {
    setSelectedEntityIds(oldValues => {
      let newValues = oldValues.slice();
      newValues.splice(index, 1);
      return newValues;
    });
  }

  let getAvatar = (type) => {
    return (
      <ListItemAvatar>
        <Tooltip title={type}>
          <Avatar
            style={{color: entitySpecs[type].color}}
            className={classes.avatar}
          >
            { entitySpecs[type].icon ? <Icon>{entitySpecs[type].icon}</Icon> : type?.charAt(0) }
          </Avatar>
        </Tooltip>
      </ListItemAvatar>
    );
  }

  let getDatePicker = (value, setter, rangeIsInvalid) => {
    return (<LocalizationProvider dateAdapter={AdapterLuxon}>
              <DateTimePicker
                label={!value ? "Any date" : "Select date"}
                inputFormat={"yyyy/MM/dd hh:mm a"}
                value={value}
                onChange={(value) => {
                  setter(value);
                }}
                renderInput={(params) =>
                  <TextField
                    variant="standard"
                    {...params}
                    error={rangeIsInvalid}
                    helperText=" "
                    InputProps={{
                      ...params.InputProps
                    }}
                    inputProps={{
                      ...params.inputProps,
                      placeholder: "Any date"
                    }}
                  />
                }
              />
            </LocalizationProvider>
          );
  }

  let getDateRange = (valueA, setterA, valueB, setterB, rangeIsInvalid) => {
    return (<>
      <Stack direction="row" spacing={2} divider={<span>—</span>} className={classes.dateRange}>
        { getDatePicker(valueA, setterA, rangeIsInvalid) }
        { getDatePicker(valueB, setterB, rangeIsInvalid) }
      </Stack>
      { rangeIsInvalid &&
        <Typography component="div" variant="caption" color="error">
          The second date should be later than the first date
        </Typography>
      }
    </>);
  }

  let getUserSelector = (label, value, setter) => {
    return (
          <Grid container alignItems='center' direction="row" className={classes.container + ' ' + classes.withSelect}>
            <Grid item xs={4}><Typography variant="subtitle2">{label}</Typography></Grid>
            <Grid item xs={8}>
                <FormControl variant="standard" fullWidth>
                  <Autocomplete
                    renderTags={() => null}
                    value={value && users.find(item => item.name == value) || null}
                    filterOptions={filterOptions}
                    onChange={(event, value) => {
                      setter(value?.name);
                    }}
                    getOptionLabel={(option) => option?.name}
                    options={users || []}
                    renderOption={(props, option) =>
                      <ListItemButton
                        value={option.name}
                        key={option.name}
                        className={classes.variableOption}
                        {...props}
                      >
                        <ListItemText primary={option.principalName} />
                      </ListItemButton>
                    }
                    renderInput={(params) =>
                      <TextField
                        variant="standard"
                        placeholder="Select user"
                        {...params}
                      />
                    }
                  />
                </FormControl>
            </Grid>
          </Grid>);
  }

  return(
    <React.Fragment>
      <ResponsiveDialog
        title={`Export "${entryName}" Data`}
        open={open}
        width="md"
        onClose={closeDialog}
      >
        <DialogContent dividers>
          <Grid container alignItems='center' direction="row" className={classes.container}>
            <Grid item xs={4}><Typography variant="subtitle2">File format:</Typography></Grid>
            <Grid item xs={8}>
              <RadioGroup
                row
                name="fileFormat"
                value={fileFormat}
                onChange={(event) => setFileFormat(event.target.value)}
              >
                <FormControlLabel value=".csv" control={<Radio />} label=".csv" />
                <FormControlLabel value=".tsv" control={<Radio />} label=".tsv" />
              </RadioGroup>
            </Grid>
          </Grid>

          <Grid container alignItems='center' direction="row" className={classes.container}>
            <Grid item xs={4}><Typography variant="subtitle2">Header format:</Typography></Grid>
            <Grid item xs={8}>
              <FormControlLabel
                control={
                  <Checkbox
                    defaultChecked={!!DEFAULTS.hasHeaderLabels}
                    onChange={(event) => { setHeaderLabels(!!event.target.checked);}}
                  />
                }
                label="Labels"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    defaultChecked={!!DEFAULTS.hasHeaderIdentifiers}
                    onChange={(event) => { setHeaderIdentifiers(!!event.target.checked);}}
                  />
                }
                label="Identifiers"
              />
            </Grid>
          </Grid>

          <Grid container alignItems='center' direction="row" className={classes.container}>
            <Grid item xs={4}><Typography variant="subtitle2">Data format:</Typography></Grid>
            <Grid item xs={8}>
              <RadioGroup
                row
                name="data"
                value={hasAnswerLabels}
                onChange={(event) => setAnswerLabels(event.target.value === "true")}
              >
                <FormControlLabel value={true} control={<Radio />} label="Labels" />
                <FormControlLabel value={false} control={<Radio />} label="Values" />
              </RadioGroup>
            </Grid>
          </Grid>

          <Divider/>

          <Typography variant="h6">Columns</Typography>

          <Grid container alignItems='center' direction="row" className={classes.container}>
            <Grid item xs={4}><Typography variant="subtitle2">Column selection mode:</Typography></Grid>
            <Grid item xs={8}>
              <RadioGroup
                row
                name="columnSelectionMode"
                value={columnSelectionMode}
                onChange={(event) => setColumnSelectionMode(event.target.value)}
              >
                <FormControlLabel value="include" control={<Radio />} label="Include" />
                <FormControlLabel value="exclude" control={<Radio />} label="Exclude" />
              </RadioGroup>
            </Grid>
          </Grid>

          <Grid container alignItems='start' direction="row" className={classes.container + ' ' + classes.withMultiSelect}>
            <Grid item xs={4}>
              <Typography variant="subtitle2">Columns to {columnSelectionMode}:</Typography>
            </Grid>
            <Grid item xs={8}>
              <List disablePadding dense>
              {/* List the entered values */}
              { entities?.filter(v => selectedEntityIds.includes(v.path)).map((value, index) => <>
                { !!index && <Divider key={`divider-${index}`} variant="inset" component="li" /> }
                <ListItem
                  key={`${value.name}-${index}`}
                  secondaryAction={
                    <Tooltip title="Delete entry">
                      <IconButton onClick={() => unselectEntity(selectedEntityIds.indexOf(value.path))}><CloseIcon/></IconButton>
                    </Tooltip>
                  }
                >
                  { getAvatar(value.type) }
                  <ListItemText primary={value.name} secondary={value.text} />
                </ListItem>
              </>)}
              </List>
              <FormControl variant="standard" fullWidth>
                <Autocomplete
                  multiple
                  value={entities?.filter(v => selectedEntityIds.includes(v.path)) || []}
                  filterOptions={filterOptions}
                  onChange={(event, value) => {
                    setSelectedEntityIds(value?.map(item => item.path));
                  }}
                  renderTags={() => null}
                  getOptionLabel={(option) => option?.name}
                  options={entities || []}
                  renderOption={(props, option) => { return !selectedEntityIds.includes(option.path) &&
                    <ListItemButton
                      value={option.path}
                      key={option.path}
                      {...props}
                    >
                      { getAvatar(option.type) }
                      <ListItemText primary={option.name} secondary={option.text} />
                    </ListItemButton>
                  }}
                  renderInput={(params) =>
                    <TextField
                      variant="standard"
                      placeholder="Select questions/sections from this questionnaire"
                      {...params}
                    />
                  }
                />
              </FormControl>
            </Grid>
          </Grid>

          <Divider/>

          <Typography variant="h6">Filters</Typography>

          { getUserSelector("Created by:", createdBy, setCreatedBy) }

          <Grid container alignItems='baseline' direction="row" className={classes.container}>
            <Grid item xs={4}><Typography variant="subtitle2">Created between:</Typography></Grid>
            <Grid item xs={8}>
              { getDateRange(createdAfter, setCreatedAfter, createdBefore, setCreatedBefore, createdRangeIsInvalid) }
            </Grid>
          </Grid>

          { getUserSelector("Last modified by:", modifiedBy, setModifiedBy) }

          <Grid container alignItems='baseline' direction="row" className={classes.container}>
            <Grid item xs={4}><Typography variant="subtitle2">Last modified between:</Typography></Grid>
            <Grid item xs={8}>
              { getDateRange(modifiedAfter, setModifiedAfter, modifiedBefore, setModifiedBefore, modifiedRangeIsInvalid) }
            </Grid>
          </Grid>

          <Grid container alignItems='center' direction="row" className={classes.container}>
              <Grid item xs={4}><Typography variant="subtitle2">Status flag selection mode:</Typography></Grid>
              <Grid item xs={8}>
                <RadioGroup
                  row
                  name="statusSelectionMode"
                  value={statusSelectionMode}
                  onChange={(event) => setStatusSelectionMode(event.target.value)}
                >
                  <FormControlLabel value="status" control={<Radio />} label="Include" />
                  <FormControlLabel value="statusNot" control={<Radio />} label="Exclude" />
                </RadioGroup>
              </Grid>
          </Grid>

          <Grid container alignItems='center' direction="row" className={classes.container + ' ' + classes.withSelect}>
            <Grid item xs={4}>
              <Typography variant="subtitle2">{statusSelectionMode == "status" ? "Include only forms with the status flag:" : "Exclude all forms with the status flag:"}</Typography>
            </Grid>
            <Grid item xs={8}>
              <FormControl variant="standard" fullWidth>
                <Autocomplete
                    value={status}
                    onChange={(event, value) => { setStatus(value); }}
                    options={statuses || []}
                    renderOption={(props, option) =>
                      <ListItemButton
                        value={option}
                        key={option}
                        className={classes.variableOption}
                        {...props}
                      >
                        <ListItemText primary={option} />
                      </ListItemButton>
                    }
                    renderInput={(params) =>
                      <TextField
                        variant="standard"
                        placeholder="Select a status flag"
                        {...params}
                      />
                    }
                />
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
            <Button variant="outlined" size="small" onClick={closeDialog}>Cancel</Button>
            <Button
              variant="contained"
              size="small"
              disabled={createdRangeIsInvalid || modifiedRangeIsInvalid}
              onClick={() => handleExport()}
            >
              Export
            </Button>
        </DialogActions>
      </ResponsiveDialog>
      {variant == "icon" ?
        <Tooltip title={entryLabel}>
          <IconButton component="span" onClick={openDialog} size={size}>
            <DownloadIcon fontSize={size == "small" ? size : undefined}/>
          </IconButton>
        </Tooltip>
        :
        <Button
          onClick={openDialog}
          size={size ? size : "medium"}
          startIcon={variant == "extended" ? <DownloadIcon /> : undefined}
        >
          {entryLabel}
        </Button>
      }
    </React.Fragment>
  )
}

ExportButton.propTypes = {
  entityData: PropTypes.object,
  entryPath: PropTypes.string.isRequired,
  entryLabel: PropTypes.string,
  entryName: PropTypes.string.isRequired,
  size: PropTypes.oneOf(["small", "medium", "large"]),
  variant: PropTypes.oneOf(["icon", "text", "extended"]), // "extended" means both icon and text
}

ExportButton.defaultProps = {
  entryLabel: "Export forms",
  variant: "icon",
  size: "large",
}

export default ExportButton;
