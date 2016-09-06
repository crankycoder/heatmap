/** # About this (particular) example study:
  *
  * - 2 'arms', `strong` and `ut`
  * - isEligible for study IFF the preference is not already user set
  * - cleanup plan:  reset the pref.
  *
  */

let prefSvc = require("sdk/preferences/service");

const OURPREF = 'extensions.@heatmap.black_list';

const variations = {
  'observe_urls':  function() {
  }
}

/** is the User Eligible?  Called during INSTALL startups */
function isEligible() {
    return true;
}

/** Cleanup to run during uninstall / removal.
  * Should attempt to reset the user to original state
  */
function cleanup () {
  // TODO: remove our preference
  // TODO: remove our local files in the profile directory
  prefSvc.reset(OURPREF);
}

module.exports = {
  isEligible: isEligible,
  cleanup: cleanup,
  variations: variations,
}
