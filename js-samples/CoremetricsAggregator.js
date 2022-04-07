/**
 *	DISCLAIMER OF WARRANTIES:
 *	-------------------------
 *	The following [enclosed] code is sample code created by IBM Corporation.
 *	This sample code is provided to you solely for the purpose of assisting
 *	you in the development of your applications.
 *	The code is provided "AS IS", without warranty of any kind. IBM shall
 *	not be liable for any damages arising out of your use of the sample code,
 *	even if they have been advised of the possibility of such damages.
 */

/**
 * This is a sample aggregator which connects to Coremetrics.
 * Before you can use this aggregator you need to specify a Coremetrics client ID,
 * a data collection domain, and a cookie domain.
 *
 * (c) Copyright IBM Corp. 2011. All rights reserved.
 */
 
(function(){

	/**
	 * The Coremetrics client ID that can be requested from Coremetrics.
	 * Must be specified as a string.
	 */
	var clientID = null;
	
	/**
	 * The Coremetrics data collection domain.
	 */	
	var dataCollectionDomain = null;
	
	/**
	 * The cookie domain of the portal server.
	 */
	var cookieDomain = null;

	/**
	 * DO NOT CHANGE THE CODE BELOW THIS LINE.
	 * (c) Copyright IBM Corp. 2011. All rights reserved.
	 */
	
	/**
	 * Regular expression to find asa tags.
	 * Locates all tags with an "asa." prefix.
	 */
	var exp = new RegExp("(^|\\s)asa\..*(\\s|$)");
	
	/**
	 * Function to construct the aggregator
	 */
	var CoremetricsAggregator = function() {

		/**
		 * The aggregator instance
		 */
		var aggr = {};

		/**
		 * Bucket for page-specific ASA tags
		 */
		var pTags = {};

		/**
		 * Public function which parses the given DOM nodes to find
		 * ASA microformats.
		 */
		aggr.parse = function(/*DOMNode[]*/ ns, /*Function?*/ cb, /*JSON*/meta) {
			if (meta.type == "PAGE") {
				// page notification
				parsePage(ns, meta.id);
			} else if (meta.type == "PORTLET") {
				// portlet notification				
				parsePortlet(ns, meta.id);
			} else if (meta.type == "AJAX") {
				// TODO
			}
			// invoke the callback (if any)
			if (cb) cb();
		};

		/**
		 * Parses the DOM to find all page-specific microformats.
		 */
		var parsePage = function(/*DOMNode[]*/ ns, /*String*/pageID) {
			// locate our root element which contains all page-specific microformats
			var pRoot = byId("asa.page");
			// data bucket
			var d = {};
			if (pRoot) {
				parse(pRoot, d);
				//console.log(i$.toJson(d));
			} else if (console) {
				console.log("WARNING: Root element for page-specific analytics tags not found.");
			}
			// update our cache
			pTags = d;
			// communicate data to Coremetrics
			if (!isEmpty(d)) {
				processRegistrationTag(d);
				processPageTags(d);
			}
		};

		/**
		 * Parses the DOM to find all portlet element-specific microformats.
		 */
		var parsePortlet = function(/*DOMNode[]*/ ns, /*String*/ portletID) {
			// check if can skip the parsing process
			if (!ns) {
				if (console) console.log("WARNING: DOM root node for portlet " + portletID + " not found.");
				return;
			}
			// iterate
			if (ns && ns.length > 0) {
				// bucket to collect the portlet data
				var d = {};
				copy(pTags, d);
				// parse the given DOM nodes for ASA microformats
				for (var i = 0, l = ns.length; i < l; ++i) {
					parse(ns[i], d);
				}
				// communicate the data to the Coremetrics server
				if (!isEmpty(d)) {
					processPortletTags(d);
				}
			}
		};

		/**
		 * Communicates the given page-specific data to the
		 * Coremetrics server by creating a pageview tag.
		 */
		var processPageTags = function(/*JSON*/ d) {
			var pgTitle = single(d["asa.page.title"]) || single(d["asa.page.id"]);
			var query = single(d["asa.search.query"]);
			var res = single(d["asa.search.results"]);
			if (res) res += "";
			var attr = [];
			setPageAttributes(attr, d);
			var pgAttr = attr.join("-_-");
			// create pageview tag
			cmCreatePageviewTag(pgTitle, "asa.page", query, res, pgAttr);
			// process analytics tags
			processAnalyticsTags(d, pgTitle, pgAttr);
		};

		/**
		 * Communicates the given page element-specific data to the
		 * Coremetrics server by creating element tags.
		 * Element tags are created for
		 *   - the portlet
		 *   - for each portlet screen
		 *   - for the web content item
		 *   - for each analytics tag (includes site promotions)
		 */
		var processPortletTags = function(/*JSON*/ d) {
			var attr = [];
			// portlet
			var pgTitle = single(d["asa.page.title"]) || single(d["asa.page.id"]);
			var ptTitle = single(d["asa.portlet.title"]) || single(d["asa.portlet.id"]);
			setPageAttributes(attr, d);
			setPortletAttributes(attr, d);
			var title = pgTitle + "::" + ptTitle;
			var ptAttr = attr.join("-_-");
			// create element tag
			cmCreateElementTag(title, "asa.portlet", ptAttr);
			// portlet screens
			var ptScr = multi(d["asa.portlet.screen.title"]);
			if (ptScr && ptScr.length > 0) {
				for (var i = 0, l = ptScr.length; i < l; ++i) {
					var scrTitle = title + "::" + ptScr[i];
					cmCreateElementTag(scrTitle, "asa.portlet.screen", ptAttr);
				}			
			}
			// analytics tags
			processAnalyticsTags(d, title, ptAttr);
			// web content
			var ctTitle = single(d["asa.wcm.content_item.title"]) || single(d["asa.wcm.content_item.id"]);
			if (ctTitle) {
				// add the content attributes
				setContentAttributes(attr, d);
				var ctAttr = attr.join("-_-");
				title += "::" + ctTitle;
				// create element tag
				cmCreateElementTag(title, "asa.wcm.content_item", ctAttr);
			}
		};

		/**
		 * Communicates the current visitor /user to the Coremetrics
		 * server by creating a registration tag. Note that the registration
		 * tag is only created on the first page of a session where the
		 * Portal visitorID exists.	The cmReg status field is set to prevent
		 * multiple registration tags that refer to the same session.
		 */
		var processRegistrationTag = function(/*JSON*/ d) {
			if (cI("cmReg") != 'Y') {
				// get the visitor ID
				var id = single(d["asa.visitor"]);
				// create registration tag
				if (id) {
					cmCreateRegistrationTag(id, null, null, null, null, null, ibmCfg.userName);
					document.cookie = "cmReg=Y; path=/";
				}
			}
		};

		/**
		 * Creates element tags for the given analytics tags (site promotions etc.)
		 */		 
		var processAnalyticsTags = function(/*JSON*/tags, /*String*/ref, /*String*/attr) {
			if (!tags) return;
			for (t in tags) {
				if (tags.hasOwnProperty(t) && t.indexOf("asa.tag.") == 0) {
					var v = multi(tags[t]);
					if (v && v.length > 0) {
						for (var i = 0, l = v.length; i < l; ++i) {
							var cat = t, title = v[i];
							cmCreateElementTag(title + "::" + ref, cat, attr);
						}
					}
				}
			}
		};
		
		/**
		 * Sets the page-specific attributes.
		 */
		var setPageAttributes = function(/*Array*/ a, /*JSON*/ d) {
			var id = single(d["asa.page.id"]);
			var tit = single(d["asa.page.title"]);
			var url = single(d["asa.url"]);
			var bc = single(d["asa.page.breadcrumb"]);
			var loc = single(d["asa.page.locale"]);
			var dir = single(d["asa.page.direction"]);
			if (id) a[19] = id;
			if (tit) a[20] = tit;
			if (loc) a[21] = loc;
			if (dir) a[22] = dir;
			if (url) a[23] = url;
			if (bc) a[24] = bc;
		};

		/**
		 * Sets the portlet-specific attributes.
		 */
		var setPortletAttributes = function(/*Array*/ a, /*JSON*/ d) {
			var id = single(d["asa.portlet.id"]);
			var tit = single(d["asa.portlet.title"]);
			var loc = single(d["asa.portlet.locale"]);
			var dir = single(d["asa.portlet.direction"]);
			var scr = multi(d["asa.portlet.screen.title"]);
			var scrID = single(d["asa.portlet.screen.id"]);
			var sel = single(d["asa.portlet.selected"]);
			if (id) a[29] = id;
			if (tit) a[30] = tit;
			if (loc) a[31] = loc;
			if (dir) a[32] = dir;
			if (scr) a[33] = scr.join(", ");
			if (scrID) a[34] = scrID;
			if (sel) a[35] = sel;
		};
		
		/**
		 * Sets the content-specific attributes.
		 */
		var setContentAttributes = function(/*Array*/ a, /*JSON*/ d) {
			var id = single(d["asa.wcm.content_item.id"]);
			var tit = single(d["asa.wcm.content_item.title"]);
			var path = single(d["asa.wcm.content_item.path"]);
			var auth = multi(d["asa.wcm.content_item.authors"]);
			if (id) a[39] = id;
			if (tit) a[40] = tit;
			if (path) a[41] = path;
			if (auth) a[42] = auth.join(", ");
		};
		
		/**
		 * Parses the DOM subtree with the given root node to find all
		 * all ASA microformats. Assumes that analytics data is only carried
		 * by span elements.
		 */
		var parse = function(/*DOMNode*/ n, /*JSON*/ b) {
			// iterate all span elements
			n = n || document;
			var s = n.getElementsByTagName("span");
			for (var i = 0, l = s.length; i < l; ++i) {
				if (!parseNode(s[i], b)) break;
			}
		};
		
		/**
		 * Parses a single DOM node to find an ASA tag.
		 */
		var parseNode = function(/*DOMNode*/ n, /*JSON*/ b) {
			// get the data tuple
			var p = asa(n);
			if (p) {
				var n = p.n, v = p.v, vs = b[n];
				if (!vs) {
					vs = [];
					b[n] = vs;
				}
				if (!contains(vs, v)) {
					vs.push(v);
				}
			}
			return true;
		};

		/**
		 * Returns the inner HTML of the element that matches the
		 * given class name.
		 */
		var asa = function(/*DOMNode*/ n) {
			var c = n.className;
			if (c && exp.test(c)) {
				// return name /value pair
				return {"n": c, "v": n.innerHTML};
			} else {
				return null;
			}
		};

		var isArray = function(o) {
			return o && (typeof o === "array" || o instanceof Array);
		};

		var byId = function(id) {
			return id ? document.getElementById(id) : null;
		};
		
		var isEmpty = function(/*Object*/o) {
			for (var k in o) {
				if (o.hasOwnProperty(k)) {
					return false;
				}
			}
			return true;
		};
		
		var contains = function(/*Array*/a, /*Object*/o) {
			if (a) {
				for (var i = a.length - 1; i >= 0; --i) {
					if (a[i] === o) {
						return true;
					}
				}
			}
			return false;
		};

		var copy = function(/*JSON*/ src, /*JSON*/ trg) {
			if (src && trg) {
				for (var key in src) {
					// don't copy analytics tags
					if (src.hasOwnProperty(key) && key.indexOf("asa.tag.") < 0) {
						trg[key] = src[key];
					}
				}
			}
		};

		var single = function(v) {
			if (v && isArray(v) && v.length > 0) {
				return v[0];
			} else {
				return v;
			}
		};

		var multi = function(v) {
			if (v && !isArray(v)) {
				return [v];
			} else {
				return v;
			}
		};
		
		return aggr;
	
	};

	// register with site analytics mediator
	if (clientID && dataCollectionDomain && cookieDomain) {

		// set the client ID
		cmSetClientID(clientID, false, dataCollectionDomain, cookieDomain);

		// workaround until onload is fixed
		var aggregator = new CoremetricsAggregator();
		com.ibm.portal.analytics.SiteAnalyticsMediator.register(function() {
			aggregator.parse.apply(aggregator, arguments);
		});	

	} else if (console) {
		if (!clientID) 
			console.log("WARNING: Cannot find Coremetrics client ID to register with Coremetrics. Please set client ID in Coremetrics aggregator.");
		if (!dataCollectionDomain) 
			console.log("WARNING: Coremetrics data collection domain not specified. Please set data collection domain in Coremetrics aggregator.");
		if (!cookieDomain) 
			console.log("WARNING: Cookie domain not specified. Please set cookie domain in Coremetrics aggregator.");
	}

})();