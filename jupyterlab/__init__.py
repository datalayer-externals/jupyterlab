"""Server extension for JupyterLab."""

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from ._version import __version__                     # noqa
from jupyterlab_server.extension import load_jupyter_server_extension  # noqa
from jupyterlab_server.commands import set_yarn_path, set_here
from jupyterlab_server.coreconfig import set_here as set_config_here

from .jlpmapp import HERE
from .jlpmapp import YARN_PATH

set_here(HERE)
set_yarn_path(YARN_PATH)
set_config_here(HERE)

def _jupyter_server_extension_paths():
    return [{'module': 'jupyterlab'}]
