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
import PropTypes from "prop-types";

import { Card, CardHeader, CardContent, withStyles } from "@material-ui/core";

import QuestionnaireStyle from "./QuestionnaireStyle";

// Holds answers and automatically generates hidden inputs
// for form submission
function Answer (props) {
  let { answers, classes, children, description, text } = props;
  return (
    <Card>
      <CardHeader
        title={text}
        />
      <CardContent>
        {description}
        {children}
        { /*Create hidden inputs with the answers here, for later form submission*/
          answers.map( (id, name) => {
          return (
            <input type="hidden" name={id} key={id} value={name}></input>
            );
        })}
      </CardContent>
    </Card>
    );
}

Answer.propTypes = {
    classes: PropTypes.object.isRequired,
    text: PropTypes.string,
    description: PropTypes.string,
    answers: PropTypes.array,
};

export default withStyles(QuestionnaireStyle)(Answer);
