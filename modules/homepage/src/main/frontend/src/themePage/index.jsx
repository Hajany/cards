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
import PropTypes from 'prop-types';
import React, { Suspense } from "react";
import ReactDOM from "react-dom";
import { MuiThemeProvider } from '@material-ui/core/styles';
import { appTheme } from "../themePalette.jsx";
import Sidebar from "./Sidebar/sidebar"
import { getRoutes } from '../routes';
import { withStyles } from '@material-ui/core';
import { Redirect, Router, Route, Switch } from "react-router-dom";
import { createBrowserHistory } from "history";
import Navbar from "./Navbars/Navbar";
import Page from "./Page";
import PageStart from "./PageStart/PageStart";
import IndexStyle from "./indexStyle.jsx";
import DialogueLoginContainer, { GlobalLoginContext } from "../login/loginDialogue.js";

class Main extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      image: "/libs/lfs/resources/background.jpg",
      color: "blue",
      hasImage: true,
      fixedClasses: "dropdown show",
      mobileOpen: false,
      routes: [],
      contentOffset: 0,
      title: document.querySelector('meta[name="title"]').content,
      color: document.querySelector('meta[name="themeColor"]')?.content || "blue",
      loginDialogOpen: false,
      loginHandlers: [],
    };

    getRoutes().then(routes => this.setState({routes: routes}));
  }

  handleDrawerToggle = () => {
    this.setState({ mobileOpen: !this.state.mobileOpen });
  };

  // Close the mobile menu if the window size changes
  // so that the mobile menu is out of place
  autoCloseMobileMenus = event => {
    if (window.innerWidth >= this.props.theme.breakpoints.values.md) {
      this.setState({ mobileOpen: false });
    }
  }

  // Register/unregister autoCloseMobileMenus to window resizing
  componentWillUnmount() {
    window.removeEventListener("resize", this.autoCloseMobileMenus);
  }

  componentDidMount() {
    window.addEventListener("resize", this.autoCloseMobileMenus);
  };

  switchRoutes = (routes) => {
    return (<Switch>
      {routes.map((route, key) => {
        return (
          <Route
            path={route["lfs:targetURL"]}
            exact={Boolean(route["lfs:exactURLMatch"])}
            render={(props) => {
                let ThisComponent = route["lfs:extensionRender"];
                let newProps = {...props, contentOffset: this.state.contentOffset };
                let title = " | " + this.state.title;
                return (
                  <Page title={title} pageDefaultName={route["lfs:extensionName"]}>
                    <ThisComponent {...newProps} />
                  </Page>
                  );
              }
            }
            key={key}
          />
        );
      })}
    </Switch>)
  };

  render() {
    const { classes, ...rest } = this.props;

    return (
      <MuiThemeProvider theme={appTheme}>
      <React.Fragment>
      <GlobalLoginContext.Provider
        value={{
          dialogOpen: (loginHandlerFcn, discardOnFailure) => {
            let handler = ((success) => {
              success && this.setState({
                loginDialogOpen: false
              });
              success && loginHandlerFcn();
            });
            (!this.state.loginDialogOpen) && this.setState({
              loginDialogOpen: true
            });
            let shouldAddHandler = (!discardOnFailure) || (this.state.loginHandlers.length < 1);
            shouldAddHandler && this.setState({
              loginHandlers: this.state.loginHandlers.concat(handler)
            });
          },
          getDialogOpenStatus: () => {
            return this.state.loginDialogOpen;
          }
        }}
      >
      <PageStart setTotalHeight={() => console.log("Placeholder for total height")}/>
        <div className={classes.wrapper} style={ { position: 'relative', top: this.state.contentOffset + 'px' } }>
          <Suspense fallback={<div>Loading...</div>}>
            <div>Sidebar has been removed</div>
            <div>Main Panel has been removed</div>
          </Suspense>
        </div>
      </GlobalLoginContext.Provider>
      </React.Fragment>
      </MuiThemeProvider>
    );
  }
}

Main.propTypes = {
  classes: PropTypes.object.isRequired
};
const MainComponent = (withStyles(IndexStyle, {withTheme: true})(Main));

const hist = createBrowserHistory();
hist.listen(({action, location}) => window.dispatchEvent(new Event("beforeunload")));
ReactDOM.render(
  <Router history={hist}>
    <Switch>
      <Route path="/content.html/" component={MainComponent} />
      <Redirect from="/" to="/content.html/Questionnaires/User"/>
      <Redirect from="/content" to="/content.html/Questionnaires/User" />
    </Switch>
  </Router>,
  document.querySelector('#main-container')
);

export default MainComponent;
