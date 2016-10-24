from marionette import Marionette

def test_simple():
    """
    Open a URL, load google.com and close the tab.
    We should be able to see the JSON blob for that go up into 
    the Miracle server.
    """
    client = Marionette('localhost', port=2828)
    client.start_session()

    url = 'http://www.google.com'
    client.navigate(url)

    time.sleep(1000)



