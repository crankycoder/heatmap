/** # About this (particular) example study:
  *
  * - 2 'arms', `strong` and `ut`
  * - isEligible for study IFF the preference is not already user set
  * - cleanup plan:  reset the pref.
  *
  */

const variations = {
  'observe_urls':  () => {}
}

/** is the User Eligible?  Called during INSTALL startups */
function isEligible() {
    /* 
     * boolean : specific to this study. Returns whether or not to
     * include this instance of the shield addon to the study.
     */
  return true;
}

/** Cleanup to run during uninstall / removal.
  * Should attempt to reset the user to original state
  */
function cleanup () {
}

module.exports = {
  isEligible: isEligible,
  cleanup: cleanup,
  variations: variations,
}
